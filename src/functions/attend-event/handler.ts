import type { ValidatedEventAPIGatewayProxyEvent } from '@libs/api-gateway';
//import { SuccessJSONResponse } from '@libs/api-gateway';
import { middyfy } from '@libs/lambda';

import schema from './schema';

import { MongoDB } from '../../util';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const attendEvent: ValidatedEventAPIGatewayProxyEvent<typeof schema> = async (
  event
) => {
  try {
    // Connect to MongoDB client
    const db = MongoDB.getInstance(process.env.DEV_MONGO_URI);
    await db.connect();
    const users = db.getCollection('users');
    const attendEvent = await users.findOne ({ "email": event.body.qr });

    console.log(attendEvent);

    // If the user does not exist, return a 404
    if (attendEvent === null) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          statusCode: 404,
          message: 'user not found'
        }),
      };
    }

    // checks if the user has already checked into the event, and if so checks if they can check in again
    if (
      attendEvent.day_of.event &&
      attendEvent.day_of.event[event.body.event] > 0 &&
      event.body.again === false
    ) {
      return {
        statusCode: 409,
        body: JSON.stringify({
          statusCode: 409,
          message: 'user already checked into event'
        }),
      };
    } else {
      const updateResult = await users.updateOne(
        { "email": event.body.qr },
        {
          $inc: { [`day_of.event.${event.body.event}`]: 1 },
          $setOnInsert: { [`day_of.event.${event.body.event}`]: 1 }
        }
      );
      return {
        statusCode: 200,
        body: JSON.stringify({
          statusCode: 200,
          message: 'user successfully checked into event'
        }),
      };
    }
  } catch (error) {
    console.error('Error attending event:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        statusCode: 500,
        message: 'internal server error',
        error
      }),
    };
  }    
};

export const main = middyfy(attendEvent);
