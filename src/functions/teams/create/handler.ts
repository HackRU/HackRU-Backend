import type { ValidatedEventAPIGatewayProxyEvent } from '@libs/api-gateway';
import { middyfy } from '@libs/lambda';
import schema from './schema';
import { MongoDB, validateToken } from '../../../util';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

interface TeamInvite {
  team_id: string;
  invited_by: string;
  invited_at: Date;
  team_name: string;
}

interface UserTeamInfo {
  team_id: string | null;
  role: 'leader' | 'member' | null;
  pending_invites: TeamInvite[];
}

interface UserDocument {
  email: string;
  confirmed_team?: boolean;
  team_info?: UserTeamInfo;
  [key: string]: unknown;
}

interface TeamDocument {
  team_id: string;
  leader_email: string;
  members: string[];
  status: 'Active' | 'Disbanded';
  team_name: string;
  created: Date;
  updated: Date;
}

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
      members: [], // Start empty, members join via accept-invite
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

    // Send invitations to all members via team-invite endpoint
    try {
      // Call team-invite endpoint to send invitations
      const invitePayload = {
        auth_token: event.body.auth_token,
        auth_email: event.body.auth_email,
        team_id: teamId,
        emails: memberEmails,
      };

      // TODO: Replace with actual /team-invite endpoint call
      // For now, we will just log the payload to simulate the call
      console.log('Would call team-invite endpoint with:', invitePayload);

      // TODO: Remove this when real endpoint exists. For now, simulate successful invitation (remove this when real endpoint exists)
      // This is temporary placeholder logic until team-invite endpoint is implemented
      for (const email of memberEmails) {
        const user = await users.findOne({ email: email });

        const newInvite: TeamInvite = {
          team_id: teamId,
          invited_by: event.body.auth_email.toLowerCase(),
          invited_at: new Date(),
          team_name: event.body.team_name,
        };

        // Initialize team_info if it doesn't exist, then add invitation
        if (!user?.team_info) {
          await users.updateOne(
            { email: email },
            {
              $set: {
                team_info: {
                  team_id: null,
                  role: null,
                  pending_invites: [newInvite],
                },
                confirmed_team: false,
              },
            }
          );
        } else {
          // Add invitation to existing team_info
          const existingInvites = user.team_info.pending_invites || [];
          await users.updateOne(
            { email: email },
            {
              $set: {
                'team_info.pending_invites': [...existingInvites, newInvite],
              },
            }
          );
        }
      }
      // TODO: End of temporary placeholder logic
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
