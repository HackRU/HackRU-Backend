/* eslint-disable @typescript-eslint/naming-convention */
import type { ValidatedEventAPIGatewayProxyEvent } from '@libs/api-gateway';
import { middyfy } from '@libs/lambda';
import { MongoDB } from '../../util';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import schema from './schema';

const submitInterestForm: ValidatedEventAPIGatewayProxyEvent<typeof schema> = async (event) => {
  try {
    // Destructure all the new fields from event.body
    const {
      firstName,
      lastName,
      age,
      phoneNumber,
      email,
      school,
      levelOfStudy,
      countryOfResidence,
      linkedInUrl,
      mlh_code_of_conduct,
      mlh_privacy_policy,
      mlh_terms_and_conditions,
    } = event.body;

    // Connect to database
    const db = MongoDB.getInstance(process.env.MONGO_URI);
    await db.connect();
    const interestFormsCollection = db.getCollection('interest-forms'); // Target collection

    // Create the document to insert
    const docToInsert = {
      firstName,
      lastName,
      age,
      phoneNumber,
      email,
      school,
      levelOfStudy,
      countryOfResidence,
      linkedInUrl,
      mlh_code_of_conduct,
      mlh_privacy_policy,
      mlh_terms_and_conditions,
    };

    const result = await interestFormsCollection.insertOne(docToInsert);

    // Return success
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Successful Form Submission',
        submissionId: result.insertedId,
      }),
    };
  } catch (error) {
    console.error('Error submitting interest form:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        statusCode: 500,
        message: 'Internal Server Error',
        error: error.message,
      }),
    };
  }
};

export const main = middyfy(submitInterestForm);
