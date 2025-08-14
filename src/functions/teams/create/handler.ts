import type { ValidatedEventAPIGatewayProxyEvent } from '@libs/api-gateway';
import { middyfy } from '@libs/lambda';
import schema from './schema';
import { MongoDB, validateToken, teamInviteLogic } from '../../../util';
import { UserDocument, TeamDocument } from 'src/types';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const teamsCreate: ValidatedEventAPIGatewayProxyEvent<typeof schema> = async (event) => {
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

    // Check if user already leads a team
    if (authUser.team_info && authUser.team_info.role === 'leader') {
      return {
        statusCode: 400,
        body: JSON.stringify({
          statusCode: 400,
          message: 'User already leads a team',
        }),
      };
    }

    // Check if user is already a member of a team
    if (authUser.confirmed_team === true) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          statusCode: 400,
          message: 'User is already part of a team',
        }),
      };
    }

    // Validate all member emails exist using user-exists logic
    const memberEmails = event.body.members.map((email) => email.toLowerCase());
    const invalidEmails = [];
    const emailsAlreadyInTeams = [];

    for (const email of memberEmails) {
      const user = await users.findOne({ email: email });
      if (!user) invalidEmails.push(email);
      else if (user.confirmed_team === true) emailsAlreadyInTeams.push(email);
    }

    // Return errors if any validation failed
    if (invalidEmails.length > 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          statusCode: 400,
          message: 'Some users do not exist',
          invalid_emails: invalidEmails,
        }),
      };
    }

    if (emailsAlreadyInTeams.length > 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          statusCode: 400,
          message: 'Some users are already part of teams',
          users_in_teams: emailsAlreadyInTeams,
        }),
      };
    }

    // Validate team size (leader + members <= 4)
    if (memberEmails.length > 3) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          statusCode: 400,
          message: 'Team size cannot exceed 4 members (including leader)',
        }),
      };
    }

    // Generate unique team ID
    const teamId = uuidv4();

    // Create team document (only with leader, members will be added via invitations)
    const teamDoc = {
      team_id: teamId,
      leader_email: event.body.auth_email.toLowerCase(),
      members: [],
      status: 'Active' as const,
      team_name: event.body.team_name,
      created: new Date(),
      updated: new Date(),
    };

    // Create team
    await teams.insertOne(teamDoc);

    // Update leader's user document
    await users.updateOne(
      { email: event.body.auth_email.toLowerCase() },
      {
        $set: {
          confirmed_team: true,
          team_info: {
            team_id: teamId,
            role: 'leader' as const,
            pending_invites: [],
          },
        },
      }
    );

    // Send invitations to all members via teamInviteLogic utility
    try {
      const inviteResult = await teamInviteLogic(event.body.auth_email, event.body.auth_token, teamId, memberEmails);

      if (inviteResult.statusCode !== 200)
        throw new Error(`Team invite failed with status ${inviteResult.statusCode}: ${inviteResult.body}`);
    } catch (inviteError) {
      console.error('Failed to send team invitations:', inviteError);

      // Clean up: delete the team since invitations failed
      await teams.deleteOne({ team_id: teamId });
      await users.updateOne(
        { email: event.body.auth_email.toLowerCase() },
        {
          $unset: { team_info: '', confirmed_team: '' },
        }
      );

      return {
        statusCode: 500,
        body: JSON.stringify({
          statusCode: 500,
          message: 'Team created but failed to send invitations',
          error: inviteError.message,
        }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        statusCode: 200,
        message: 'Team created successfully',
        team_id: teamId,
      }),
    };
  } catch (error) {
    console.error('Error creating team:', error);
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

export const main = middyfy(teamsCreate);
