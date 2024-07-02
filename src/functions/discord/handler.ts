import type { ValidatedEventAPIGatewayProxyEvent } from '@libs/api-gateway';
import { middyfy } from '@libs/lambda';

import schema from './schema';

import { MongoDB, validateToken } from '../../util';
import * as discordAPI from '@libs/discord';

import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const discord: ValidatedEventAPIGatewayProxyEvent<typeof schema> = async (event) => {
  const email = event.body.email.toLowerCase();
  const isValidToken = validateToken(event.body.auth_token, process.env.JWT_SECRET, email);
  if (!isValidToken) {
    return {
      statusCode: 401,
      body: JSON.stringify({
        statusCode: 401,
        message: 'Unauthorized',
      }),
    };
  }

  try {
    const db = MongoDB.getInstance(process.env.DEV_MONGO_URI);
    await db.connect();
    const users = db.getCollection('users');

    const user = await users.findOne({ email: email });
    if (!user) {
 return {
        statusCode: 404,
        body: JSON.stringify({
          statusCode: 404,
          message: 'User not found',
        }),
      }; 
}

    const tokens = await discordAPI.getDiscordTokens(event.body.code);
    const discordUser = await discordAPI.getDiscordUser(tokens.accessToken);
    await discordAPI.updateDiscordMetadata(tokens.accessToken, user.first_name + ' ' + user.last_name, {
      verified: new Date().toISOString(),
      checkedIn: user.registration_status == 'checked-in' ? 1 : 0,
    });

    await users.updateOne(
      { email: email },
      {
        $set: {
          discord: {
            user_id: discordUser.userId,
            username: discordUser.username,
            access_token: tokens.accessToken,
            refresh_token: tokens.refreshToken,
            expires_at: tokens.expiresAt,
          },
        },
      }
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        statusCode: 200,
        message: 'Discord user verified',
        discordId: discordUser.userId,
        discordUsername: discordUser.username,
      }),
    };
  } catch (error) {
    console.error('Error updating discord', error);

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

export const main = middyfy(discord);
