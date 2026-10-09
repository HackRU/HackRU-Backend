import type { ValidatedEventAPIGatewayProxyEvent } from '@libs/api-gateway';
//import { SuccessJSONResponse } from '@libs/api-gateway';
import { middyfy } from '@libs/lambda';

import schema from './schema';

import { MongoDB, validateToken, ensureRoles } from '../../util';
import type { UserDocument } from 'src/types';

const attendEvent: ValidatedEventAPIGatewayProxyEvent<typeof schema> = async (event) => {
  try {
    // validate auth token
    const isValidToken = validateToken(event.body.auth_token, process.env.JWT_SECRET, event.body.auth_email);
    if (!isValidToken) {
      return {
        statusCode: 401,
        body: JSON.stringify({ statusCode: 401, message: 'Unauthorized.' }),
      };
    }

    // Connect to MongoDB
    const db = MongoDB.getInstance(process.env.MONGO_URI);
    await db.connect();
    const users = db.getCollection<UserDocument>('users');

    const attendEvent = await users.findOne({ email: event.body.qr });

    // If the user does not exist, return a 404
    if (attendEvent === null) {
      return {
        statusCode: 404,
        body: JSON.stringify({ statusCode: 404, message: 'User not found.' }),
      };
    }

    // ensure that only directors/organizers (auth_email) can call this route
    const authUser = await users.findOne({ email: event.body.auth_email });
    if (!authUser) {
      return {
        statusCode: 404,
        body: JSON.stringify({ statusCode: 404, message: 'Auth user not found.' }),
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

    if (attendEvent.registration_status != 'checked_in') {
      return {
        statusCode: 409,
        body: JSON.stringify({
          statusCode: 409,
          message: 'User has not checked in. Current status is ' + attendEvent.registration_status,
        }),
      };
    }

    // conditions to check a user into events during hackathon
    const hackEvent = event.body.event;

    // mongo reads a dot as a nested path and a leading $ as an operator
    if (hackEvent.includes('.') || hackEvent.startsWith('$')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ statusCode: 400, message: 'Event name cannot contain "." or start with "$".' }),
      };
    }

    // gets the current time
    const currentTime = new Date().toISOString();
    const attendance = attendEvent.day_of?.event?.[hackEvent]?.attend ?? 0;

    // if attended this event the max times allowed as per limit
    if (attendance > 0 && attendance >= event.body.limit) {
      return {
        statusCode: 409,
        body: JSON.stringify({
          statusCode: 409,
          message: 'User already checked into event.',
          attendance,
        }),
      };
    }

    // check the balance before recording anything, so a refused purchase leaves no attendance behind
    const points = db.getCollection('f26-points');
    if (event.body.points < 0) {
      const userPoints = await points.findOne({ email: event.body.qr });
      if ((userPoints?.balance ?? 0) + event.body.points < 0) {
        return {
          statusCode: 409,
          body: JSON.stringify({
            statusCode: 409,
            message: 'User does not have enough points to check into event.',
            balance: userPoints?.balance ?? 0,
          }),
        };
      }
    }

    await users.updateOne(
      { email: event.body.qr },
      {
        $inc: { [`day_of.event.${hackEvent}.attend`]: 1 },
        $push: { [`day_of.event.${hackEvent}.time`]: currentTime },
      }
    );

    if (event.body.points) {
      // note: the operation is $inc but since points is negative, it will still subtract
      await points.updateOne(
        { email: event.body.qr },
        {
          $inc: { balance: event.body.points, total_points: Math.max(event.body.points, 0) },
          $setOnInsert: { first_name: attendEvent.first_name, last_name: attendEvent.last_name },
        },
        { upsert: true }
      );
    }

    // return success case
    return {
      statusCode: 200,
      body: JSON.stringify({
        statusCode: 200,
        message: 'user successfully checked into event',
        attendance: attendance + 1,
      }),
    };
  } catch (error) {
    console.error('Error attending event:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ statusCode: 500, message: 'Internal server error.', error }),
    };
  }
};

export const main = middyfy(attendEvent);
