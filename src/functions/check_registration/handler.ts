import type { ValidatedEventAPIGatewayProxyEvent } from '@libs/api-gateway';
//import { SuccessJSONResponse } from '@libs/api-gateway';
import { middyfy } from '@libs/lambda';

import schema from './schema';

import { MongoDB } from '../../util';
import * as config from '../../config'; // eslint-disable-line

const checkRegistration: ValidatedEventAPIGatewayProxyEvent<
  typeof schema
> = async (event) => {
  const registrationStatus = await queryByEmail(
    event.body.email,
    config.DEV_MONGO_URI
  );
  return {
    statusCode: 200,
    body: JSON.stringify({
      email: event.body.email,
      status: registrationStatus,
    }),
  };
};

async function queryByEmail(
  email: string,
  mongoURI: string
): Promise<string | null> {
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

    // If the object exists, return its registrationStatus
    if (result) {
      return result.registrationStatus;
    } else {
      // If the object does not exist, return null or throw an error
      return null;
    }
  } catch (error) {
    console.error('Error querying MongoDB:', error);
    throw error;
  }
}

export const main = middyfy(checkRegistration);
