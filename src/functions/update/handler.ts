import type { ValidatedEventAPIGatewayProxyEvent } from '@libs/api-gateway';
//import { SuccessJSONResponse, FailureJSONResponse } from '@libs/api-gateway';
import { middyfy } from '@libs/lambda';

import schema from './schema';

import { validateEmail } from '../../helper';

import { MongoDB, validateToken, ensureRoles } from '../../util';
import { Document, WithId } from 'mongodb';

// lambdas run in UTC, so the offset pins this to Eastern time
const CHECK_IN_START_DATE = new Date('2026-10-10T10:30:00-04:00');
const CHECK_IN_CUT_OFF = new Date(CHECK_IN_START_DATE.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 days after check-in start
const toEastern = (date: Date) => `${date.toLocaleString('en-US', { timeZone: 'America/New_York' })} ET`;

const update: ValidatedEventAPIGatewayProxyEvent<typeof schema> = async (event) => {
  // if user email = auth email, you're updating auth user
  // need to follow FSM for registration status
  try {
    // validate auth token
    const validToken = validateToken(event.body.auth_token, process.env.JWT_SECRET, event.body.auth_email);
    if (!validToken) {
      return {
        statusCode: 401,
        body: JSON.stringify({ statusCode: 401, message: 'Unauthorized' }),
      };
    }

    // connect to DB
    const db = MongoDB.getInstance(process.env.MONGO_URI);
    await db.connect();
    const users = db.getCollection('users');

    // ensure that auth user can only have role director or organizer
    const authUser = await users.findOne({ email: event.body.auth_email });
    if (authUser) {
      if (!ensureRoles(authUser.role, ['director', 'organizer', 'hacker'])) {
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
        body: JSON.stringify({ statusCode: 404, message: 'Auth user not found.' }),
      };
    }

    // need to check if user_email exists in DB
    const updatedUser = await users.findOne({ email: event.body.user_email });

    if (!updatedUser) {
      return {
        statusCode: 404,
        body: JSON.stringify({ statusCode: 404, message: 'User to be updated not found.' }),
      };
    }

    //only director or organizer should be able to update registration status for specified status descriptions
    const registrationStatus = event.body.updates?.$set?.registration_status as string | undefined;

    if (
      registrationStatus !== undefined &&
      ['rejected', 'confirmation', 'waitlist', 'confirmed', 'checked_in'].includes(registrationStatus)
    ) {
      if (!ensureRoles(authUser.role, ['director', 'organizer'])) {
        return {
          statusCode: 403,
          body: JSON.stringify({
            statusCode: 403,
            message: `Forbidden. Auth user must be organizer/director to update registration status to ${registrationStatus}.`,
          }),
        };
      }
    }

    // validate updates
    const validationResult = validateUpdates(event.body.updates, updatedUser.registration_status, updatedUser);
    if (typeof validationResult === 'string') {
      return {
        statusCode: 400,
        body: JSON.stringify({ statusCode: 400, message: validationResult }),
      };
    } else if (!validationResult) {
      return {
        statusCode: 400,
        body: JSON.stringify({ statusCode: 400, message: 'Bad updates.' }),
      };
    }

    // add registered_at time if status is updated
    if (event.body.updates?.$set?.registration_status == 'registered')
      event.body.updates.$set['registered_at'] = new Date().toISOString();

    // call updates
    // directors/organizers can update anyone, hackers can only update themselves
    if (authUser.role['director'] || authUser.role['organizer'])
      await users.updateOne({ email: event.body.user_email }, event.body.updates);
    else if (authUser.role['hacker']) await users.updateOne({ email: authUser.email }, event.body.updates);

    // send to sns if registration status is updated (turn off this feature for now)
    // if (event.body.updates?.$set?.registration_status) {
    //   const emailPayload = {
    //     email: event.body.user_email,
    //     first_name: updatedUser.first_name,
    //     last_name: updatedUser.last_name,
    //     registration_status: event.body.updates.$set.registration_status || 'error',
    //   };
    //   // publish to sns topic
    //   const sns = new AWS.SNS();
    //   await sns
    //     .publish({
    //       TopicArn: process.env.SNS_TOPIC_ARN,
    //       Message: JSON.stringify(emailPayload),
    //     })
    //     .promise();
    // }

    return {
      statusCode: 200,
      body: JSON.stringify({ statusCode: 200, message: 'User updated successfully' }),
    };
  } catch (error) {
    console.error('Error updating', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ statusCode: 500, message: 'Internal server error', error }),
    };
  }
};

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
  confirmed: ['checked_in', 'not_coming'],
  waitlist: ['checked_in'],
  checked_in: [],
};

function isValidRegistrationStatusUpdate(current: string, goal: string): boolean {
  if (current in registrationStatusGraph) return registrationStatusGraph[current].includes(goal);
  return false;
}

// return true or false whether the proposed update is valid or not

function validateUpdates(updates: Updates, registrationStatus?: string, user?: WithId<Document>): boolean | string {
  const setUpdates = updates.$set;
  if (setUpdates) {
    // Checked before registration_status: that branch returns early in several places, and any of
    // those returns would otherwise let a locked field through alongside a valid status change.
    if (
      ['_id', 'password', 'discord', 'created_at', 'registered_at', 'email_verified', 'role'].some(
        (lockedProp) => lockedProp in setUpdates
      )
    )
      return 'Cannot update locked fields';

    if ('email' in setUpdates) if (!validateEmail(setUpdates.email)) return 'Improper Email format';

    if ('registration_status' in setUpdates) {
      const currentDate = new Date();
      const goalStatus = setUpdates.registration_status as string;

      if (goalStatus === 'checked_in') {
        if (currentDate > CHECK_IN_CUT_OFF)
          return `Registration is closed. The cutoff date was ${toEastern(CHECK_IN_CUT_OFF)}.`;
      }

      const atleastRegistered = ['confirmed', 'waitlist', 'registered', 'coming'].includes(
        registrationStatus || 'unregistered'
      );
      if (goalStatus === 'checked_in' && atleastRegistered) {
        if (currentDate >= CHECK_IN_START_DATE || registrationStatus === 'confirmed') return true;
        else
          return `Current status of this user is ${registrationStatus}. Check-in will be available after ${toEastern(CHECK_IN_START_DATE)}.`;
      }

      if (!isValidRegistrationStatusUpdate(registrationStatus || 'unregistered', goalStatus))
        return `Invalid registration status update from ${registrationStatus} to ${goalStatus}`;

      if ((registrationStatus === undefined || registrationStatus == 'unregistered') && goalStatus === 'registered') {
        if (
          [
            'email',
            'password',
            'github',
            'major',
            'short_answer',
            'shirt_size',
            'first_name',
            'last_name',
            'dietary_restrictions',
            'special_needs',
            'school',
            'grad_year',
            'gender',
            'level_of_study',
            'ethnicity',
            'phone_number',
          ].some((registrationField) => !user[registrationField] || user[registrationField] === '')
        )
          return 'Missing required fields';
      } else return true;
    }

    return true;
  }
}

export const main = middyfy(update);
