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
    const pointsCollection = db.getCollection('s25-points-syst');

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

    // get users points

    const pointUser = await pointsCollection.findOne(
      { email: email },
      // eslint-disable-next-line @typescript-eslint/naming-convention
      { projection: { _id: 0, balance: 1, total_points: 1, buy_ins: 1 } }
    );

    if (!pointUser) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          statusCode: 404,
          message: 'Points not found for this user.',
        }),
      };
    }

    // Check if esists
    const buyIns = Array.isArray(pointUser.buy_ins) ? pointUser.buy_ins : [];

    return {
      statusCode: 200,
      body: JSON.stringify({
        statusCode: 200,
        balance: pointUser.balance,
        total_points: pointUser.total_points,
        buy_ins: buyIns,
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
