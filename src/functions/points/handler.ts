import type { ValidatedEventAPIGatewayProxyEvent } from '@libs/api-gateway';
import { middyfy } from '@libs/lambda';
import schema from './schema';
import { MongoDB, validateToken } from '../../util';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });


const points: ValidatedEventAPIGatewayProxyEvent<typeof schema> = async (event) => {
  const email = event.body.email.toLowerCase();

  try {

    // check token
    const isValidToken = validateToken(event.body.auth_token, process.env.JWT_SECRET, email);
    if (!isValidToken) {
      return {
        statusCode: 401,
        body: JSON.stringify({
          statusCode: 401,
          message: 'Unauthorized',
        }),
      };
    }

    // Connect to DB
    const db = MongoDB.getInstance(process.env.MONGO_URI);
    await db.connect();
    const users = db.getCollection('users');
    const pointsCollection = db.getCollection('f24-points-syst');

    // Make sure user exists
    const user = await users.findOne({ email: email });
    if (!user) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          statusCode: 404,
          message: 'User not found.',
        }),
      };
    }

    const pointUser = await pointsCollection.findOne({ user_email: email });
    if (!pointUser) {
      const pointUser = {
        email: email,
        balance: 0,
        total_points: 0,
      };
      
      await pointsCollection.insertOne(pointUser);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        balance: pointUser.balance,
        total_points: pointUser.total_points,
      }),
    };
    
  } catch (error) {
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

export const main = middyfy(points);
