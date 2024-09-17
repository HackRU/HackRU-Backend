import type { ValidatedEventAPIGatewayProxyEvent } from '@libs/api-gateway';
import { middyfy } from '@libs/lambda';
import schema from './schema';
import { MongoDB, validateToken } from '../../util';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// email verification regex
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const points: ValidatedEventAPIGatewayProxyEvent<typeof schema> = async (event) => {
  const email = event.body.email.toLowerCase();

  try {
    // check if email is valid. (Explicit per Ethan's /points writeup)
    if (!emailRegex.test(email)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          statusCode: 400,
          message: 'Invalid email format',
        }),
      };
    }

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
    // TODO: Uncomment the following line after implementing the points collection
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

    // TODO: Find user's points in "pointsCollection"
    const pointUser = await users.findOne({ email: email });
    if (!pointUser) {
      const newPointUser = {
        email: email,
        balance: 0,
        total_points: 0,
      };
      await pointsCollection.insertOne(newPointUser);
      return {
        statusCode: 200,
        body: JSON.stringify({
          statusCode: 200,
          message: 'Retrieved user points',
          points: newPointUser,
        }),
      };
    }
    // TODO: Validate if user's points exist

    // TODO: Return user's points data with stat code 200
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Retrieved user points',
        points: pointUser,
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
