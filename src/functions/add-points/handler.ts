import type { ValidatedEventAPIGatewayProxyEvent } from '@libs/api-gateway';
//import { SuccessJSONResponse } from '@libs/api-gateway';
import { middyfy } from '@libs/lambda';

import schema from './schema';
import * as config from '../../config';

import { MongoDB, validateToken, ensureRoles } from '../../util';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const addPoints: ValidatedEventAPIGatewayProxyEvent<typeof schema> = async (event) => {
  try {
    // validate auth token
    const isValidToken = validateToken(event.body.auth_token, process.env.JWT_SECRET, event.body.auth_email);
    if (!isValidToken) {
      return {
        statusCode: 401,
        body: JSON.stringify({
          statusCode: 401,
          message: 'Unauthorized.',
        }),
      };
    }

    // Connect to MongoDB
    const db = MongoDB.getInstance(process.env.MONGO_URI);
    await db.connect();
    const users = db.getCollection('users');

    // ensure that only directors/organizers can call this route
    const authUser = await users.findOne({ email: event.body.auth_email });
    if (!authUser) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          statusCode: 404,
          message: 'Auth user not found.',
        }),
      };
    }

    if (!ensureRoles(authUser.role, ['director', 'organizer'])) {
      return {
        statusCode: 401,
        body: JSON.stringify({
          statusCode: 401,
          message: 'Only directors/organizers can call this endpoint.',
        }),
      };
    }

    const points = db.getCollection(config.pointsCollection);
    const userPoints = await points.findOne({ email: event.body.hacker_email });
    let newBalance;
    if (!userPoints) {
      await points.insertOne({ email: event.body.hacker_email, balance: event.body.amount });
      newBalance = event.body.amount;
    } else {
      newBalance = userPoints.balance + event.body.amount;
      await points.updateOne({ email: event.body.hacker_email }, { $set: { balance: newBalance } });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        statusCode: 200,
        message: 'Successfully added points',
        balance: newBalance,
      }),
    };
  } catch (error) {
    console.error('Error adding points:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        statusCode: 500,
        message: 'Internal Server Error',
        error,
      }),
    };
  }
};

export const main = middyfy(addPoints);
