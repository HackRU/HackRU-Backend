import type { ValidatedEventAPIGatewayProxyEvent } from '@libs/api-gateway';
import { middyfy } from '@libs/lambda';

import schema from './schema';

import { MongoDB } from '../../util';

import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

import * as path from 'path';
import * as dotenv from 'dotenv';
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

    const token = crypto.randomInt(0, 9999999).toString().padStart(7, '0');
    const hashedToken = await bcrypt.hash(token, 8);

    const forgotPasswordDB = db.getCollection('forgot-password');
    await forgotPasswordDB.insertOne({
      email: email,
      token: hashedToken,
      expiration: Date.now() + 15 * 60 * 1000,
    });

    const ses = new SESv2Client();
    const passwordReset = new SendEmailCommand({
      FromEmailAddress: 'no-reply@hackru.org',
      Destination: {
        ToAddresses: [email],
      },
      Content: {
        Simple: {
          Subject: {
            Data: 'HackRU Password Reset',
          },
          Body: {
            Html: {
              Data: `<p>Hey ${user.first_name + ' ' + user.last_name}!</p><p>Here is your HackRU password reset code: <strong>${token}</strong></p><p>This code expires in 15 minutes. Do not share it with others.</p><p>If you did not request a password reset, you can safely ignore this message.</p><p>- HackRU Team</p>`,
            },
            Text: {
              Data: `Hey ${user.first_name + ' ' + user.last_name}!\n\nHere is your HackRU password reset code: ${token}\n\nThis code expires in 15 minutes. Do not share it with others.\n\nIf you did not request a password reset, you can safely ignore this message.\n\n- HackRU Team`,
            },
          },
        },
      },
    });
    await ses.send(passwordReset);

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
