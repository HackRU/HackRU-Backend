import type { ValidatedEventAPIGatewayProxyEvent } from '@libs/api-gateway';
import { middyfy } from '@libs/lambda';
import * as bcrypt from 'bcryptjs';

import schema from './schema';

import { MongoDB } from '../../util';

import * as path from 'path';
import * as dotenv from 'dotenv';
import * as jwt from 'jsonwebtoken';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const forgotPassword: ValidatedEventAPIGatewayProxyEvent<typeof schema> = async (event) => {
  const email = event.body.email.toLowerCase();

  try {
    const db = MongoDB.getInstance(process.env.MONGO_URI);
    await db.connect();
    const users = db.getCollection('users');

    const user = await users.findOne({ email: email });
    if (!user) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          message: 'User not found',
        }),
      };
    }

    // generate password reset token
    const token = require('crypto').randomBytes(16).toString('base64');

    // hash token
    const hashedToken = await bcrypt.hash(token, 8);

    const forgotPasswordDB = db.getCollection('forgot-password');
    // store email, hashed token, and expiration (15 min) in db
    await forgotPasswordDB.insertOne({
      email: email,
      token: hashedToken,
      expiration: Date.now() + 15 * 60 * 1000,
    });

    // send email with reset info (original token before hash)

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Password reset info emailed',
      }),
    };
  } catch (error) {
    console.error('Error generating password reset', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Internal Server Error',
        error: error,
      }),
    };
  }
};

export const main = middyfy(forgotPassword);
