import type { ValidatedEventAPIGatewayProxyEvent } from '@libs/api-gateway';
import { middyfy } from '@libs/lambda';
import * as bcrypt from 'bcryptjs';

import schema from './schema';

import { MongoDB } from '../../util';
import * as config from '../../config';

import { validateEmail } from '../../helper';

import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const create: ValidatedEventAPIGatewayProxyEvent<typeof schema> = async (event) => {
  const validRegistrationTime = registrationTime();
  //check link
  if (!validRegistrationTime) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        statusCode: 400,
        message: 'Registration is closed!',
      }),
    };
  }

  const uEmail = event.body.email.toLowerCase();
  if (!validateEmail(uEmail)) {
    return {
      statusCode: 403,
      body: JSON.stringify({
        statusCode: 403,
        message: 'Improper Email format',
      }),
    };
  }
  let password = event.body.password;

  try {
    //hash password
    password = await bcrypt.hash(password, 8);

    const db = MongoDB.getInstance(process.env.MONGO_URI);
    await db.connect();

    //try to pull user from db by email to ensure there is no duplicate registration
    const users = db.getCollection('users');
    const existingUser = await users.findOne({ email: uEmail });

    if (existingUser) {
      //link
      return {
        statusCode: 400,
        body: JSON.stringify({
          statusCode: 400,
          message: 'Duplicate user!',
        }),
      };
    }
    // Check if interest form exists, if so retrieve data from the most recent submission
    const interestForms = db.getCollection('interest-forms');
    const interestFormsData = await interestForms.findOne({ email: uEmail }, { sort: { submittedAt: -1 } });
    const doc = {
      email: uEmail,
      email_verified: false,
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
      github: event.body.github ?? '',
      major: event.body.major ?? '',
      short_answer: event.body.short_answer ?? '',
      shirt_size: event.body.shirt_size ?? '',
      first_name: event.body.first_name ?? interestFormsData?.firstName ?? '',
      last_name: event.body.last_name ?? interestFormsData?.lastName ?? '',
      age: interestFormsData?.age?.toString() ?? event.body.age ?? '',
      dietary_restrictions: event.body.dietary_restrictions ?? '',
      special_needs: event.body.special_needs ?? '',
      date_of_birth: event.body.date_of_birth ?? '',
      school: interestFormsData?.school ?? event.body.school ?? '',
      grad_year: event.body.grad_year ?? '',
      gender: event.body.gender ?? '',
      level_of_study: interestFormsData?.levelOfStudy ?? event.body.level_of_study ?? '',
      ethnicity: event.body.ethnicity ?? '',
      phone_number: interestFormsData?.phoneNumber ?? event.body.phone_number ?? '',
      country_of_residence: interestFormsData?.countryOfResidence ?? event.body.country_of_residence ?? '',
      registration_status: 'unregistered',
      day_of: {
        checkIn: false,
      },
      discord: {
        user_id: '',
        username: '',
        access_token: '',
        refresh_token: '',
        expires_at: 0,
      },
      created_at: new Date().toISOString(),
      registered_at: null,
      interestFormMigrated: interestFormsData ? true : false,
      interestFormMigratedAt: interestFormsData ? new Date().toISOString() : null,
    };

    await users.insertOne(doc);

    if (interestFormsData) {
      try {
        await interestForms.updateOne(
          { _id: interestFormsData._id },
          {
            $set: {
              migrated_to_user_account: true,
              migrated_at: new Date().toISOString(),
            },
          }
        );
      } catch (migrationError) {
        console.warn('Failed to mark interest form as migrated:', migrationError);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        statusCode: 200,
        message: 'User created!',
      }),
    };
  } catch (error) {
    console.error('Error creating user', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        statusCode: 500,
        message: 'Internal Server Error',
        error: error,
      }),
    };
  }
};

const registrationTime = (): boolean => {
  //records time of registration and checks if it is within registration start and end dates
  const now = new Date().getTime();

  const registrationStart = new Date(config.registrationStart).getTime();
  const registrationEnd = new Date(config.registrationEnd).getTime();

  return now >= registrationStart && now <= registrationEnd;
};

export const main = middyfy(create);
