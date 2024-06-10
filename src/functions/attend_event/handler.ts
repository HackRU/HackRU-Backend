import type { ValidatedEventAPIGatewayProxyEvent } from '@libs/api-gateway';
//import { SuccessJSONResponse } from '@libs/api-gateway';
import { middyfy } from '@libs/lambda';

import schema from './schema';

import { MongoDB } from '../../util';
import * as config from '../../config';

const attend_event: ValidatedEventAPIGatewayProxyEvent<typeof schema> = async (
  event
) => {
  const attend_event = await queryByEmail(event.body.qr, config.DEV_MONGO_URI);
  if (attend_event === null) {
    return {
      statusCode: 404,
      body: JSON.stringify({
        message: 'user not found',
      }),
    };
  }
  if (!attend_event.day_of) {
    attend_event.day_of = {};
  }
  if (!attend_event.day_of.event) {
    attend_event.day_of.event = new Map();
  }
  if (
    attend_event.day_of.event.has(event.body.event) &&
    attend_event.day_of.event.get(event.body.event) > 0 &&
    event.body.again === false
  ) {
    return {
      statusCode: 409,
      body: JSON.stringify({
        message: 'user already checked into event',
      }),
    };
  } else {
    attendEvent(event.body.qr, config.DEV_MONGO_URI, event.body.event);
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'user successfully checked into event',
      }),
    };
  }
};

async function queryByEmail(email: string, mongoURI: string) {
  // Connect to MongoDB
  try {
    const db = MongoDB.getInstance(mongoURI);
    await db.connect();
    const client = db.getClient();

    // Access the database and collection
    const collection = client
      .db('dev')
      .collection(config.DB_COLLECTIONS['users']);

    // Query the object based on the email
    const result = await collection.findOne({ email });

    // If the object exists, return it
    if (result) {
      return result;
    } else {
      // If the object does not exist, return null or throw an error
      return null;
    }
  } catch (error) {
    console.error('Error querying MongoDB:', error);
    throw error;
  }
}

async function attendEvent(email: string, mongoURI: string, event: string) {
  // Connect to MongoDB
  try {
    const db = MongoDB.getInstance(mongoURI);
    await db.connect();
    const client = db.getClient();

    // Access the database and collection
    const collection = client
      .db('dev')
      .collection(config.DB_COLLECTIONS['users']);

    // Query the object based on the email
    const result = await collection.findOne({ email });

    if (!result.day_of) {
      result.day_of = {};
    }
    if (!result.day_of.event) {
      result.day_of.event = new Map();
      result.day_of.event.set(event, 1);
      collection.updateOne({ ...result }, { dayOf_event: result.day_of.event });
      return;
    }
    if (result.day_of.event.has(event)) {
      result.day_of.event.set(event, result.day_of.event.get(event) + 1);
      collection.updateOne({ ...result }, { dayOf_event: result.day_of.event });
      return;
    } else {
      result.day_of.event.set(event, 1);
      collection.updateOne({ ...result }, { dayOf_event: result.day_of.event });
    }
  } catch (error) {
    console.error('Error querying MongoDB:', error);
    throw error;
  }
}

export const main = middyfy(attend_event);
