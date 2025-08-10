import type { ValidatedEventAPIGatewayProxyEvent } from '@libs/api-gateway';
import { middyfy } from '@libs/lambda';
import schema from './schema';
import { MongoDB, validateToken } from '../../../util';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { UserDocument, TeamDocument } from '../../../types';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const teamsMemberRemoval: ValidatedEventAPIGatewayProxyEvent<typeof schema> = async (event) => {
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

    // Check if team exists
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

    // Check if team is active
    if (team.status !== 'Active') {
      return {
        statusCode: 400,
        body: JSON.stringify({
          statusCode: 400,
          message: 'Cannot remove members from disbanded team',
        }),
      };
    }

    // Check if auth user is the team leader
    if (team.leader_email !== event.body.auth_email.toLowerCase()) {
      return {
        statusCode: 403,
        body: JSON.stringify({
          statusCode: 403,
          message: 'Only team leader can remove members',
        }),
      };
    }

    // Process target emails
    const targetEmails = event.body.member_emails.map((email) => email.toLowerCase());

    // Prevent leader from removing themselves
    if (targetEmails.includes(event.body.auth_email.toLowerCase())) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          statusCode: 400,
          message: 'Team leader cannot remove themselves from the team',
        }),
      };
    }

    let membersAffected = 0;

    // Process each target email to determine if they are team members or have pending invites
    for (const targetEmail of targetEmails) {
      // Check if user exists
      const targetUser = await users.findOne({ email: targetEmail });

      if (!targetUser) {
        // Skip non-existent users
        continue;
      }

      // Check if user is a team member
      const isTeamMember = team.members.includes(targetEmail);

      // Check if user has pending invite for this team
      const hasPendingInvite = targetUser.team_info?.pending_invites?.some(
        (invite) => invite.team_id === event.body.team_id
      );

      if (isTeamMember) {
        // Remove from team members list
        await teams.updateOne(
          { team_id: event.body.team_id },
          {
            $pull: { members: targetEmail },
            $set: { updated: new Date() },
          }
        );

        // Update user's team info
        await users.updateOne(
          { email: targetEmail },
          {
            $set: {
              confirmed_team: false,
              team_info: {
                team_id: null,
                role: null,
                pending_invites:
                  targetUser.team_info?.pending_invites?.filter((invite) => invite.team_id !== event.body.team_id) ||
                  [],
              },
            },
          }
        );

        membersAffected++;
      } else if (hasPendingInvite) {
        // Remove pending invite only
        const updatedInvites = targetUser.team_info.pending_invites.filter(
          (invite) => invite.team_id !== event.body.team_id
        );

        await users.updateOne(
          { email: targetEmail },
          {
            $set: {
              'team_info.pending_invites': updatedInvites,
            },
          }
        );

        membersAffected++;
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Team members removed successfully',
        members_affected: membersAffected,
      }),
    };
  } catch (error) {
    console.error('Error removing team members:', error);
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

export const main = middyfy(teamsMemberRemoval);
