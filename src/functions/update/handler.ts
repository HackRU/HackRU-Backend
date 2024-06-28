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
    const validToken = validateToken(event.body.auth_token, process.env.JWT_SECRET, event.body.auth_email);
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
      if (!ensureRoles(authUser.role, ['director', 'organizer', 'hacker'])) {
        // might need to change this
        return {
          statusCode: 401,
          body: JSON.stringify({
            statusCode: 401,
            message: 'Unauthorized. Auth user is not an organizer/director/hacker.',
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
    const updatedUser = await users.findOne({ email: event.body.user_email });
    if (!updatedUser) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          statusCode: 404,
          message: 'User to be updated not found.',
        }),
      };
    }

    // validate updates
    const isValidUpdates = validateUpdates(event.body.updates, updatedUser.registration_status);
    if (!isValidUpdates) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          statusCode: 400,
          message: 'Bad updates.',
        }),
      };
    }

    // call updates
    // directors/organizers can update anyone, hackers can only update themselves
    if (authUser.role['director'] || authUser.role['organizer']) {
      await users.updateOne({ email: event.body.user_email }, { $set: event.body.updates });
    } else if (authUser.role === 'hacker') {
      await users.updateOne({ email: authUser.email }, { $set: event.body.updates });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        statusCode: 200,
        message: 'User updated successfully',
      }),
    };
  } catch (error) {
    console.error('Error updating', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        statusCode: 500,
        message: 'Internal server error',
        error,
      }),
    };
  }
};

// might or might not need this interface

interface Updates {
  $set?: Record<string, boolean | string | number>;
}

// this function needs to check:
// 1. valid registration_status upgrade (use graph, refer to link)
// 2. no alteration to fields such as: _id, password,

const registrationStatusGraph = {
  unregistered: ['registered'],
  registered: ['rejected', 'confirmation', 'waitlist'],
  confirmation: ['coming', 'not_coming'],
  rejected: ['checked_in'],
  coming: ['not_coming', 'confirmed'],
  not_coming: ['coming', 'waitlist'],
  confirmed: ['checked_in'],
  waitlist: ['checked_in'],
  checked_in: [],
};

function isValidRegistrationStatusUpdate(current: string, goal: string): boolean {
  if (current in registrationStatusGraph) return registrationStatusGraph[current].includes(goal);
  return false;
}

// return true or false whether the proposed update is valid or not
function validateUpdates(updates: Updates, registrationStatus?: string): boolean {
  const setUpdates = updates.$set;
  if ('registration_status' in setUpdates) {
    const goalStatus = setUpdates.registration_status as string;
    if (!isValidRegistrationStatusUpdate(registrationStatus || 'unregistered', goalStatus)) return false;
  } else if ('_id' in setUpdates || 'password' in setUpdates) return false;
  return true;
}

export const main = middyfy(update);
