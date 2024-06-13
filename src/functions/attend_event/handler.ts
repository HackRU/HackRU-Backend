import type { ValidatedEventAPIGatewayProxyEvent } from '@libs/api-gateway';
//import { SuccessJSONResponse } from '@libs/api-gateway';
import { middyfy } from '@libs/lambda';

import schema from './schema';

import { MongoDB } from '../../util';
import * as config from '../../config';

const attendEvent: ValidatedEventAPIGatewayProxyEvent<typeof schema> = async (
  event
) => {
  // Query the user by email
  const attend_event = await queryByEmail(event.body.qr, config.DEV_MONGO_URI);

  // If the user does not exist, return a 404
  if (attend_event === null) {
    return {
      statusCode: 404,
      body: JSON.stringify({
        message: 'user not found',
      }),
    };
  }

  // checks to see if the day_of object exists
  if (!attend_event.day_of || !attend_event.day_of.event) {
    attend_event.day_of = { event: {} };
  }
  // checks if the user has already checked into the event, and if so checks if they can check in again
  if (
    attend_event.day_of.event[event.body.event] &&
    attend_event.day_of.event[event.body.event] > 0 &&
    event.body.again === false
  ) {
    return {
      statusCode: 409,
      body: JSON.stringify({
        message: 'user already checked into event',
      }),
    };
  } else {
    attendUserEvent(attend_event, config.DEV_MONGO_URI, event.body.event);
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'user successfully checked into event',
      }),
    };
  }
};

async function queryByEmail(email: string, mongoURI: string) {
  try {
    // Connect to MongoDB
    const client = await connectToClient(mongoURI);

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

async function attendUserEvent(attend_event, mongoURI: string, event: string) {
  // connect to MongoDb client
  const client = await connectToClient(mongoURI);

  // Access the database and collection
  const collection = client
    .db('dev')
    .collection(config.DB_COLLECTIONS['users']);

  const email = attend_event.email;

  // checks if the event exists in the day_of object, and if so increments the count
  if (attend_event.day_of.event[event]) {
    attend_event.day_of.event[event] += 1;
    await collection.updateOne(
      { email: email },
      { $set: { 'day_of.event': attend_event.day_of.event } }
    );
    return;
  } else {
    attend_event.day_of.event[event] = 1;
    await collection.updateOne(
      { email: email },
      { $set: { 'day_of.event': attend_event.day_of.event } }
    );
    return;
  }
}

// connects ti the MongoDB client
async function connectToClient(mongoURI: string) {
  try {
    const db = MongoDB.getInstance(mongoURI);
    await db.connect();
    return db.getClient();
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    throw error;
  }
}

export const main = middyfy(attendEvent);
