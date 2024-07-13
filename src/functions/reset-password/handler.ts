import type { ValidatedEventAPIGatewayProxyEvent } from '@libs/api-gateway';
//import { SuccessJSONResponse, FailureJSONResponse } from '@libs/api-gateway';
import { middyfy } from '@libs/lambda';
import * as bcrypt from 'bcryptjs';

import schema from './schema';

import { MongoDB } from '../../util';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const resetPassword: ValidatedEventAPIGatewayProxyEvent<typeof schema> = async (event) => {
  const userEmail = event.body.email.toLowerCase();

  try {
    // check if email in the body exists
    const db = MongoDB.getInstance(process.env.MONGO_URI);
    await db.connect();
    const forgotPasswordDB = db.getCollection('forgot-password');

    const existingEmail = await forgotPasswordDB.findOne({ email: userEmail });
    if (!existingEmail) {
      return {
        statusCode: 403,
        body: JSON.stringify({
          message: 'Invalid email',
        }),
      };
    }

    // check if resetToken is valid
    const isValid = await bcrypt.compare(event.body.reset_token, existingEmail.token);
    if (!isValid) {
      return {
        statusCode: 401,
        body: JSON.stringify({
          message: 'Reset token is invalid',
        }),
      };
    }

    // check if resetToken has expired
    const storedDatetime = new Date(existingEmail.expiration);
    const now = new Date();

    const hasExpired = now.getTime() - storedDatetime.getTime() > 15 * 60 * 1000; // if greater than 15 minutes
    if (hasExpired) {
      return {
        statusCode: 401,
        body: JSON.stringify({
          message: 'Reset token has expired',
        }),
      };
    }

    // all checks have passed, now update password
    // hash new password first
    const hashedNewPassword = await bcrypt.hash(event.body.new_password, 8);

    // update pw
    const users = db.getCollection('users');
    await users.updateOne({ email: userEmail }, { $set: { password: hashedNewPassword } });

    // delete forgot-password object upon successful pw reset
    await forgotPasswordDB.deleteOne({ email: userEmail });

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Password reset successful',
      }),
    };
  } catch (error) {
    console.error('Error reseting password', error);

    // return a 500 Status code error
    return {
      statusCode: 500,
      body: JSON.stringify({
        statusCode: 500,
        message: 'Internal Server Error',
        error,
      }),
    };
  }
};

export const main = middyfy(resetPassword);
