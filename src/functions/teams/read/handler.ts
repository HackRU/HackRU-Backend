import type { ValidatedEventAPIGatewayProxyEvent } from '@libs/api-gateway';
import { middyfy } from '@libs/lambda';

import schema from './schema';

import { ensureRoles, MongoDB, validateToken } from '../../../util';
import type { UserDocument, TeamDocument } from '../../../types';

import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const teamsRead: ValidatedEventAPIGatewayProxyEvent<typeof schema> = async (event) => {
  try {
    // Validate auth token
    const isValidToken = validateToken(event.body.auth_token, process.env.JWT_SECRET, event.body.auth_email);
    if (!isValidToken) {
      return {
        statusCode: 401,
        body: JSON.stringify({
          statusCode: 401,
          message: 'Unauthorized',
        }),
      };
    }

    // Connect to database
    const db = MongoDB.getInstance(process.env.MONGO_URI);
    await db.connect();
    const users = db.getCollection<UserDocument>('users');
    const teams = db.getCollection<TeamDocument>('teams');

    // Check if auth user exists
    const authUser = await users.findOne({ email: event.body.auth_email.toLowerCase() });
    if (!authUser) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          statusCode: 404,
          message: 'Auth user not found',
        }),
      };
    }

    let teamId = event.body.team_id;

    // Determine auth user permissions
    const isOrganizer = ensureRoles(authUser.role, ['director', 'organizer']);
    if (
      ((teamId && authUser.team_info?.team_id !== teamId) ||
        (!teamId && event.body.auth_email !== event.body.member_email)) &&
      !isOrganizer
    ) {
      return {
        statusCode: 401,
        body: JSON.stringify({
          statusCode: 401,
          message: 'Unauthorized',
        }),
      };
    }

    // Fetch team id if member_email specified
    if (!teamId) {
      const teamUser = await users.findOne({ email: event.body.member_email.toLowerCase() });
      if (!teamUser) {
        return {
          statusCode: 404,
          body: JSON.stringify({
            statusCode: 404,
            message: 'Team user not found',
          }),
        };
      }

      if (!teamUser.team_info?.team_id) {
        return {
          statusCode: 404,
          body: JSON.stringify({
            statusCode: 404,
            message: `User (${event.body.member_email}) is not in an active team`,
          }),
        };
      }

      teamId = teamUser.team_info.team_id;
    }

    // Fetch team and validate status
    const team = await teams.findOne({ team_id: teamId });
    if (!team) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          statusCode: 404,
          message: 'Team not found',
        }),
      };
    }

    if (team.status !== 'Active') {
      return {
        statusCode: 400,
        body: JSON.stringify({
          statusCode: 400,
          message: 'Team is not active',
        }),
      };
    }

    // Return team data
    return {
      statusCode: 200,
      body: JSON.stringify({
        statusCode: 200,
        message: 'Successfully read team',
        team: JSON.stringify(team),
      }),
    };
  } catch (error) {
    console.error('Error reading team:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        statusCode: 500,
        message: 'Internal Server Error',
        error: error.message,
      }),
    };
  }
};

export const main = middyfy(teamsRead);
