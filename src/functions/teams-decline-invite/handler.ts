import type { ValidatedEventAPIGatewayProxyEvent } from '@libs/api-gateway';
//import { SuccessJSONResponse, FailureJSONResponse } from '@libs/api-gateway';
import { middyfy } from '@libs/lambda';
//import * as bcrypt from 'bcryptjs';

import schema from './schema';

import { MongoDB, validateToken } from '../../util';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

//import * as jwt from 'jsonwebtoken';

const declineInvitation: ValidatedEventAPIGatewayProxyEvent<typeof schema> = async (event) => {
  const { team_id } = event.body;
  const auth_email = event.body.auth_email.toLowerCase();

  // try to validate token
  try {
    const isValidToken = validateToken(event.body.auth_token, process.env.JWT_SECRET, auth_email);
    if (!isValidToken) {
      return {
        statusCode: 401,
        body: JSON.stringify({
          statusCode: 401,
          message: 'Unauthorized',
        }),
      };
    }

    const db = MongoDB.getInstance(process.env.MONGO_URI);
    await db.connect();
    const users = db.getCollection('users');

    // find the user 
    const user = await users.findOne({ email: auth_email });
    if (!user) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          statusCode: 404,
          message: 'User not found.',
        }),
      };
    }

    // get the user's pending invites list 
    const pending_invitations = user.team_info?.pending_invites || [];
    const team_id_invite = pending_invitations.some((invite: any) => invite.team_id === team_id);
    if (!team_id_invite) { // if that team's invite is NOT in the pending invites list
      return {
        statusCode: 400,
        body: JSON.stringify({
          statusCode: 400,
          message: 'No pending invitation found for this team',
        }),
      };
    }

    //remove that invite from pending invitations list
    const updatedInvites = pending_invitations.filter((invite: any) => invite.team_id !== team_id);
    await users.updateOne(
      { email: auth_email },
      { $set: { 'team_info.pending_invites': updatedInvites } }
    );

    return { // successful response body
      statusCode: 200,
      body: JSON.stringify({
        statusCode: 200,
        message: 'Team invitation declined successfully',
      }),
    };
  } catch (error) {
    console.error('Error declining invite', error);

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

export const main = middyfy(declineInvitation);