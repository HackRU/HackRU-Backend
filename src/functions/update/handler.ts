import type { ValidatedEventAPIGatewayProxyEvent } from '@libs/api-gateway';
//import { SuccessJSONResponse, FailureJSONResponse } from '@libs/api-gateway';
import { middyfy } from '@libs/lambda';

import schema from './schema';

import { MongoDB, validateToken, ensureRoles } from '../../util';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const update: ValidatedEventAPIGatewayProxyEvent<typeof schema> = async (event) => {
  // if user email = auth email, you're updating auth user
  // need to follow FSM for registration status
  try {
    // validate auth token
    const validToken = validateToken(event.body.auth_token, process.env.JWT_SECRET);
    if (!validToken) {
      return {
        statusCode: 401,
        body: JSON.stringify({
          statusCode: 401,
          message: 'Unauthorized',
        }),
      }; 
    }

    // connect to DB
    const db = MongoDB.getInstance(process.env.DEV_MONGO_URI);
    await db.connect();
    const users = db.getCollection('users');

    // ensure that auth user can only have role director or organizer
    const authUser = await users.findOne({ email: event.body.auth_email });
    if (authUser) {
      if (!ensureRoles(authUser.role, ['director', 'organizer'])) {
        return {
          statusCode: 401,
          body: JSON.stringify({
            statusCode: 401,
            message: 'Unauthorized. Auth user is not an organizer/director.',
          }),
        }; 
      }
    } else {
      return {
        statusCode: 404,
        body: JSON.stringify({
          statusCode: 404,
          message: 'Auth user not found.',
        }),
      }; 
    }

    // need to check if user_email exists in DB

    // validate updates

    // call updates

  } catch (error) {
    console.error('Error updating', error)
  }
};

// might or might not need this interface

// interface Updates { 
//   $set: Record<string, string> | Record<string, number>;
//   $inc: Record<string, number>;
//   $push: Record<string, string>;
// }

// this function needs to check: 
// 1. valid registration_status upgrade (use graph, refer to link)
// 2. no alteration to fields such as: _id, password, 

// function validate_updates(updates: )

export const main = middyfy(update);