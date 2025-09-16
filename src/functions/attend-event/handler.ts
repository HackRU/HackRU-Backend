import type { ValidatedEventAPIGatewayProxyEvent } from '@libs/api-gateway';
//import { SuccessJSONResponse } from '@libs/api-gateway';
import { middyfy } from '@libs/lambda';

import schema from './schema';

import { MongoDB, validateToken, ensureRoles } from '../../util';
import type { UserDocument } from '../../types';
import { RegistrationStatus } from '../../types';
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
    const users = db.getCollection<UserDocument>('users');

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

    if (attendEvent.registration_status != RegistrationStatus.CHECKED_IN) {
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
    } else if (attendEvent.day_of.event[hackEvent].attend >= event.body.limit) {
      // if attended this event the max times allowed as per limit
      return {
        statusCode: 409,
        body: JSON.stringify({
          statusCode: 409,
          message: 'User already checked into event.',
          attendance: attendEvent.day_of.event[hackEvent].attend,
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

    if (event.body.points) {
      const points = db.getCollection('s25-points-syst');
      const userPoints = await points.findOne({ email: event.body.qr });
      if (!userPoints) {
        await points.insertOne({
          email: event.body.qr,
          first_name: attendEvent.first_name,
          last_name: attendEvent.last_name,
          balance: 0,
          total_points: 0,
        });
      }

      if (event.body.points < 0 && userPoints.balance + event.body.points < 0) {
        return {
          statusCode: 409,
          body: JSON.stringify({
            statusCode: 409,
            message: 'User does not have enough points to check into event.',
            balance: userPoints.balance,
          }),
        };
      }

      if (event.body.points < 0)
        // note: the operation is $inc but since points is negative, it will still subtract
        await points.updateOne({ email: event.body.qr }, { $inc: { balance: event.body.points } });
      else if (event.body.points > 0) {
        await points.updateOne(
          { email: event.body.qr },
          { $inc: { balance: event.body.points, total_points: event.body.points } }
        );
      }
    }

    // return success case
    return {
      statusCode: 200,
      body: JSON.stringify({
        statusCode: 200,
        message: 'user successfully checked into event',
        attendance: attendEvent.day_of.event?.[hackEvent]?.attend ? attendEvent.day_of.event[hackEvent].attend + 1 : 1,
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
