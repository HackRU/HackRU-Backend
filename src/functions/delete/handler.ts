import type { ValidatedEventAPIGatewayProxyEvent } from '@libs/api-gateway';
import { middyfy } from '@libs/lambda';
import schema from './schema';
import { MongoDB, validateToken, ensureRoles, UserDoc } from '../../util';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const deleteUser: ValidatedEventAPIGatewayProxyEvent<typeof schema> = async (event) => {
  try {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const { auth_email, auth_token, user_email } = event.body;

    // 1. Validate auth token
    const tokenValid = validateToken(auth_token, process.env.JWT_SECRET, auth_email);
    if (!tokenValid) {
      return {
        statusCode: 401,
        body: JSON.stringify({ statusCode: 401, message: 'Unauthorized' }),
      };
    }

    // 2. Connect to MongoDB
    const db = MongoDB.getInstance(process.env.MONGO_URI);
    await db.connect();
    const users = db.getCollection<UserDoc>('users');

    // 3. Check target user exists
    const target = await users.findOne({ email: user_email });
    if (!target) {
      return {
        statusCode: 404,
        body: JSON.stringify({ statusCode: 404, message: 'User not found' }),
      };
    }

    // 4. Verify auth user exists
    const authUser = await users.findOne({ email: auth_email });
    if (!authUser) {
      return {
        statusCode: 404,
        body: JSON.stringify({ statusCode: 404, message: 'Auth user not found' }),
      };
    }

    // 5. Ensure auth user role
    if (!ensureRoles(authUser.role, ['director', 'organizer'])) {
      return {
        statusCode: 401,
        body: JSON.stringify({ statusCode: 401, message: 'Only directors/organizers can call this endpoint.' }),
      };
    }

    // 6. Delete the user
    const result = await users.deleteOne({ email: user_email });
    if (result.deletedCount !== 1) {
      // Shouldn't happen since we checked existence
      return {
        statusCode: 500,
        body: JSON.stringify({ statusCode: 500, message: 'Internal server error' }),
      };
    }

    // 7. Success
    return {
      statusCode: 200,
      body: JSON.stringify({ statusCode: 200, message: `Deleted ${user_email} successfully` }),
    };
  } catch (error) {
    console.error('Error deleting user:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ statusCode: 500, message: 'Internal server error' }),
    };
  }
};

export const main = middyfy(deleteUser);
