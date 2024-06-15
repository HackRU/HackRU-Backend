import type { ValidatedEventAPIGatewayProxyEvent } from '@libs/api-gateway';
//import { SuccessJSONResponse, FailureJSONResponse } from '@libs/api-gateway';
import { middyfy } from '@libs/lambda';
import * as bcrypt from 'bcryptjs';

import schema from './schema';

import { MongoDB } from '../../util';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import * as jwt from 'jsonwebtoken';

const authorize: ValidatedEventAPIGatewayProxyEvent<typeof schema> = async (
  event
) => {
  const userEmail = event.body.email;
  const userPassword = event.body.password;

  // check to see if email is present in DB
  try {
    const db = MongoDB.getInstance(process.env.DEV_MONGO_URI);
    await db.connect();
    const client = db.getClient();
    const users = client.db('dev').collection('users');

    const existingEmail = await users.findOne({ email: userEmail });
    if (existingEmail) {
      // if user email exist but password doesn't match, return error
      const hashedPassword = existingEmail.password.toString('utf8');
      const passwordMatch = await bcrypt.compare(
        userPassword,
        hashedPassword
      );

      if (!passwordMatch) {
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
      { email: userEmail, id: existingEmail._id },
      process.env.JWT_SECRET,
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

    // return a 500 Status code error
    return {
      statusCode: 500,
      body: JSON.stringify({
        statusCode: 500,
        message: 'Internal Server Error',
      }),
    };
  }
};

export const main = middyfy(authorize);
