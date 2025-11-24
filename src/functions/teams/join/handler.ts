import type { ValidatedEventAPIGatewayProxyEvent } from '@libs/api-gateway';
import { middyfy } from '@libs/lambda';
import schema from './schema';
import { MongoDB, validateToken } from '../../../util';
import { UserDocument, TeamDocument, TeamStatus, TeamRole } from '../../../types';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const teamsJoin: ValidatedEventAPIGatewayProxyEvent<typeof schema> = async (event) => {
  try {
    // Validate auth token
    const isValidToken = validateToken(event.body.auth_token, process.env.JWT_SECRET, event.body.auth_email);
    if (!isValidToken) {
      return {
        statusCode: 401,
        body: JSON.stringify({
          statusCode: 401,
          message: 'Unauthorized - Invalid token',
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

    // Verify that user is not already part of a team
    if (authUser.confirmed_team === true) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          statusCode: 400,
          message: 'User is already part of a team',
        }),
      };
    }

    // Validate that user has the team_id in their pending invites
    const pendingInvites = authUser.team_info?.pending_invites || [];
    const invitation = pendingInvites.find((invite) => invite.team_id === event.body.team_id);

    if (!invitation) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          statusCode: 400,
          message: 'No pending invitation found for this team',
        }),
      };
    }

    // Check if team exists and is active
    const team = await teams.findOne({ team_id: event.body.team_id });
    if (!team) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          statusCode: 404,
          message: 'Team not found',
        }),
      };
    }

    if (team.status !== TeamStatus.ACTIVE) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          statusCode: 400,
          message: 'Cannot join disbanded team',
        }),
      };
    }

    // Check team capacity (max 4 members including leader)
    const currentTeamSize = team.members.length + 1; // +1 for leader
    if (currentTeamSize >= 4) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          statusCode: 400,
          message: 'Team is at maximum capacity',
        }),
      };
    }

    // Add user to team members list
    await teams.updateOne(
      { team_id: event.body.team_id },
      {
        $push: { members: event.body.auth_email.toLowerCase() },
        $set: { updated: new Date() },
      }
    );

    // Update user document
    const remainingInvites = pendingInvites.filter((invite) => invite.team_id !== event.body.team_id); // sexy as hell one-liner

    await users.updateOne(
      { email: event.body.auth_email.toLowerCase() },
      {
        $set: {
          confirmed_team: true,
          team_info: {
            team_id: event.body.team_id,
            role: TeamRole.MEMBER,
            pending_invites: remainingInvites,
          },
        },
      }
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        statusCode: 200,
        message: 'Successfully joined team',
        team_id: event.body.team_id,
      }),
    };
  } catch (error) {
    console.error('Error joining team:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        statusCode: 500,
        message: 'Internal server error',
        error: error.message,
      }),
    };
  }
};

export const main = middyfy(teamsJoin);
