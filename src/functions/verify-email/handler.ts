import type { ValidatedEventAPIGatewayProxyEvent } from '@libs/api-gateway';
import { middyfy } from '@libs/lambda';

import schema from './schema';

import { MongoDB, validateToken, verifyEmailCode } from '../../util';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import * as jwt from 'jsonwebtoken';
import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';

const verifyEmail: ValidatedEventAPIGatewayProxyEvent<typeof schema> = async (event) => {
  if (event.body.code) {
    const verifiedEmail = verifyEmailCode(event.body.code, 'HRUV' + process.env.JWT_SECRET);
    if (!verifiedEmail) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Invalid email verification code. It may be expired.' }),
      };
    }

    try {
      const db = MongoDB.getInstance(process.env.MONGO_URI);
      await db.connect();
      const users = db.getCollection('users');

      const user = await users.findOne({ email: verifiedEmail });
      if (!user) {
        return {
          statusCode: 404,
          body: JSON.stringify({ message: 'User not found' }),
        };
      }

      await users.updateOne(
        { email: verifiedEmail },
        {
          $set: {
            email_verified: true,
          },
        }
      );

      return {
        statusCode: 200,
        body: JSON.stringify({ message: `HackRU account (${verifiedEmail}) email verified successfully.` }),
      };
    } catch (error) {
      console.error('Error verifying email', error);

      return {
        statusCode: 500,
        body: JSON.stringify({
          message: 'Internal Server Error',
          error: error,
        }),
      };
    }
  }

  const email = event.body.email.toLowerCase();
  const isValidToken = validateToken(event.body.auth_token, process.env.JWT_SECRET, email);
  if (!isValidToken) {
    return {
      statusCode: 401,
      body: JSON.stringify({
        message: 'Unauthorized',
      }),
    };
  }

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

    if (user.email_verified) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'User email already verified',
        }),
      };
    }

    const verifyCode = jwt.sign({ email: email, id: user._id }, 'HRUV' + process.env.JWT_SECRET, { expiresIn: '3d' });

    const ses = new SESv2Client();
    const emailVerification = new SendEmailCommand({
      FromEmailAddress: 'no-reply@hackru.org',
      Destination: {
        ToAddresses: [email],
      },
      Content: {
        Simple: {
          Subject: {
            Data: 'HackRU Verify Email',
          },
          Body: {
            Html: {
              Data: `<p>Hey ${user.first_name + ' ' + user.last_name}!</p><p>You can use this link to verify your HackRU account email: <a href="https://hackru.org/verify/${verifyCode}">https://api.hackru.org/verify-email/${verifyCode}</a></p><p>This link expires in 3 days. Do not share it with others.</p><p>If you did not create a HackRU account, you can safely ignore this message.</p><p>- HackRU Team</p>`,
            },
            Text: {
              Data: `Hey ${user.first_name + ' ' + user.last_name}!\n\nYou can use this link to verify your HackRU account email: https://hackru.org/verify/${verifyCode}\n\nThis link expires in 3 days. Do not share it with others.\n\nIf you did not create a HackRU account, you can safely ignore this message.\n\n- HackRU Team`,
            },
          },
        },
      },
    });
    await ses.send(emailVerification);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'User email verification sent',
      }),
    };
  } catch (error) {
    console.error('Error verifying email', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Internal Server Error',
        error: error,
      }),
    };
  }
};

export const main = middyfy(verifyEmail);
