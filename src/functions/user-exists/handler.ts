import type { ValidatedEventAPIGatewayProxyEvent } from '@libs/api-gateway';
import { middyfy } from '@libs/lambda';
import schema from './schema';
import { MongoDB, validateToken } from '../../util';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const userExists: ValidatedEventAPIGatewayProxyEvent<typeof schema> = async (event) => {
  try {
    //Check token validity
    const isValidToken = validateToken(event.body.auth_token, process.env.JWT_SECRET, event.body.auth_email);
    if (!isValidToken) {
      return {
        statusCode: 401,
        body: JSON.stringify({
          statuscode: 401,
          message: 'Unauthorized',
        }),
      };
    }

    //Connect to DB
    const db = MongoDB.getInstance(process.env.MONGO_URI);
    await db.connect();
    const users = db.getCollection('users');

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

    //Check if user being looked up exists
    const lookupUser = await users.findOne(
      { email: event.body.email.toLowerCase() },
      { projection: { password: 0, _id: 0 } }
    );
    if (!lookupUser) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          statusCode: 404,
          message: 'Look-up user was not found',
        }),
      };
    }
    //return that user exists
    return {
      statusCode: 200,
      body: JSON.stringify('User exists'),
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
export const main = middyfy(userExists);
