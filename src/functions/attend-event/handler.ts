import type { ValidatedEventAPIGatewayProxyEvent } from '@libs/api-gateway';
//import { SuccessJSONResponse } from '@libs/api-gateway';
import { middyfy } from '@libs/lambda';

import schema from './schema';

import { MongoDB, validateToken, ensureRoles, UserDoc } from '../../util';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const attendEvent: ValidatedEventAPIGatewayProxyEvent<typeof schema> = async (event) => {
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
    const users = db.getCollection<UserDoc>('users');

    const attendEvent = await users.findOne({ email: event.body.qr });

    // If the user does not exist, return a 404
    if (attendEvent === null) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          statusCode: 404,
          message: 'User not found.',
        }),
      };
    }

    // ensure that only directors/organizers (auth_email) can call this route
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

    // conditions to check a user into events during hackathon
    const hackEvent = event.body.event;

    // gets the current time
    const currentTime = new Date().toISOString();

    // if never attended this event before
    if (attendEvent.day_of?.event?.[hackEvent] === undefined) {
      await users.updateOne(
        { email: event.body.qr },
        {
          $set: { [`day_of.event.${hackEvent}.attend`]: 1 },
          $push: { [`day_of.event.${hackEvent}.time`]: currentTime },
        }
      );
    } else if (event.body.again === false) {
      // if can only attend this event once and user has already attended
      return {
        statusCode: 409,
        body: JSON.stringify({
          statusCode: 409,
          message: 'User already checked into event.',
        }),
      };
    } else {
      // if can attend this event more than once and user has attended before
      await users.updateOne(
        { email: event.body.qr },
        {
          $inc: { [`day_of.event.${hackEvent}.attend`]: 1 },
          $push: { [`day_of.event.${hackEvent}.time`]: currentTime },
        }
      );
    }

    // return success case
    return {
      statusCode: 200,
      body: JSON.stringify({
        statusCode: 200,
        message: 'user successfully checked into event',
      }),
    };
  } catch (error) {
    console.error('Error attending event:', error);
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

export const main = middyfy(attendEvent);
