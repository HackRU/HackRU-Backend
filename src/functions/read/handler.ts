import type { ValidatedEventAPIGatewayProxyEvent } from '@libs/api-gateway';
import { middyfy } from '@libs/lambda';
import schema from './schema';
import { MongoDB, validateToken, ensureRoles } from '../../util';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const read: ValidatedEventAPIGatewayProxyEvent<typeof schema> = async (event) => {
  try {
    // Check if token is valid
    const isValidToken = validateToken(event.body.token, process.env.JWT_SECRET, event.body.auth_email);
    if (!isValidToken) {
      return {
        statusCode: 401,
        body: JSON.stringify({
          statuscode: 401,
          message: 'Unauthorized',
        }),
      };
    }

    // Connect to DB
    const db = MongoDB.getInstance(process.env.DEV_MONGO_URI);
    await db.connect();
    const users = db.getCollection('users');

    // Ensure auth user exists
    const authUser = await users.findOne({ email: event.body.auth_email });
    if (!authUser) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          statuscode: 404,
          message: 'Auth user not found.',
        }),
      };
    }

    // Ensure user has proper role
    const roles = ['hacker', 'director', 'organizer'];
    if (!ensureRoles(authUser.role, roles)) {
      return {
        statusCode: 401,
        body: JSON.stringify({
          statusCode: 401,
          message: 'Unauthorized role.',
        }),
      };
    }

    const lookupEmail = event.body.email;
    if (authUser.role === 'hacker' && authUser.email !== lookupEmail) {
      return {
        statusCode: 403,
        body: JSON.stringify({
          statusCode: 403,
          message: 'Hackers can only look up their own information.',
        }),
      };
    }

    // Find the user
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const user = await users.findOne({ email: lookupEmail }, { projection: { password: 0, _id: 0 } }); // exclude password and id
    if (!user) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          statusCode: 404,
          message: 'User not found.',
        }),
      };
    }

    // Return user data
    return {
      statusCode: 200,
      body: JSON.stringify(user),
    };
  } catch (error) {
    console.error('Error reading user:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        statusCode: 500,
        message: 'Internal server error.',
        error,
      }),
    };
  }
};

export const main = middyfy(read);
