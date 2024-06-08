import type { ValidatedEventAPIGatewayProxyEvent } from '@libs/api-gateway';
//import { SuccessJSONResponse, FailureJSONResponse } from '@libs/api-gateway';
import { middyfy } from '@libs/lambda';
import * as bcrypt from 'bcryptjs';

import schema from './schema';

import { MongoDB } from '../../util';
import * as config from '../../config'; // eslint-disable-line

import * as jwt from 'jsonwebtoken'

const authorize: ValidatedEventAPIGatewayProxyEvent<typeof schema> = async (
  event
) => {
  const user_email = event.body.email;
  const user_password = event.body.password;

  // check to see if email is present in DB
  try {
    const db = MongoDB.getInstance(config.DEV_MONGO_URI);
    await db.connect();
    const client = db.getClient();
    const users = client.db('dev').collection('users');

    const existingEmail = await users.findOne({ email: user_email });
    if (existingEmail) {
      // if user email exist but password doesn't match, return error
      const hashedPassword = existingEmail.password.toString('utf8');
      const password_match = await bcrypt.compare(
        user_password,
        hashedPassword
      );

      if (!password_match) {
        return {
          statusCode: 403,
          body: JSON.stringify({
            statusCode: 403,
            message: 'Wrong password',
          }),
        };
      }
    } else {
      // user email doesn't exist
      return {
        statusCode: 403,
        body: JSON.stringify({
          statusCode: 403,
          message: 'Invalid email',
        }),
      };
    }

    // password match, now we build a JWT to use as an authentication token

    // builds token
    const token = jwt.sign(
      { email: user_email, id: existingEmail._id },
      config.JWT_SECRET,
      { expiresIn: '3d' }
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        statusCode: 200,
        message: 'Authentication Successful',
        token,
      }),
    };
  } catch (error) {
    console.error('Error authorizing user', error);
  }
};

export const main = middyfy(authorize);
