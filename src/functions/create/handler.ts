import type { ValidatedEventAPIGatewayProxyEvent } from '@libs/api-gateway';
import schema from './schema';

import { MongoDB } from '../../util';
import * as config from '../../config';
import { middyfy } from '@libs/lambda';

const create: ValidatedEventAPIGatewayProxyEvent<typeof schema> = async (
  event
) => {
  const validRegistrationTime = registrationTime();
  //check link
  if (!validRegistrationTime) {
    return {
      statusCode: 403,
      body: 'Registration is closed!',
    };
  }

  const u_email = event.body.email;
  const password = event.body.password;
  //hash password

  try {
    const db = MongoDB.getInstance(config.DEV_MONGO_URI);
    await db.connect();
    const client = db.getClient();

    const users = client.db('dev').collection(config.DB_COLLECTIONS['users']);
    const existingUser = await users.findOne({ u_email });

    if (!existingUser) {
      //link
      return {
        statusCode: 400,
        body: 'Duplicate user!',
      };
    }
    //add registration status
    const doc = {
      email: u_email,
      role: {
        hacker: true,
        volunteer: false,
        judge: false,
        sponsor: false,
        mentor: false,
        organizer: false,
        director: false,
      },
      votes: 0,
      password: password,
      github: event.queryStringParameters?.github,
      major: event.queryStringParameters?.major,
      short_answer: event.queryStringParameters?.short_answer,
      shirt_size: event.queryStringParameters?.shirt_size,
      first_name: event.queryStringParameters?.github,
      last_name: event.queryStringParameters?.last_name,
      dietary_restrictions: event.queryStringParameters?.dietary_restrictions,
      special_needs: event.queryStringParameters?.special_needs,
      date_of_birth: event.queryStringParameters?.date_of_birth,
      school: event.queryStringParameters?.school,
      grad_year: event.queryStringParameters?.grad_year,
      gender: event.queryStringParameters?.gender,
      level_of_study: event.queryStringParameters?.level_of_study,
      ethnicity: event.queryStringParameters?.ethnicity,
      phone_numer: event.queryStringParameters?.phone_number,
      day_of: {
        checkIn: false,
      },
    };

    await users.insertOne(doc);
    return {
      statusCode: 200,
      body: 'User created!',
    };
  } catch (error) {
    console.error('Error creating user', error);
  }
};

const registrationTime = (): boolean => {
  const now = new Date().getTime();

  //arbitrary start and end dates for registration for now
  const registrationStart = new Date(config.registrationStart).getTime();
  const registrationEnd = new Date(config.registrationEnd).getTime();

  return now >= registrationStart && now <= registrationEnd;
};

export const main = middyfy(create);
