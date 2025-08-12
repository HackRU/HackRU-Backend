// src/functions/teams/invite/handler.ts
import * as dotenv from 'dotenv';
import * as path from 'path';
import type { ValidatedEventAPIGatewayProxyEvent } from '@libs/api-gateway';
import { middyfy } from '@libs/lambda';
import schema from './schema';
import type { Failure, TeamInvite, TeamDocument, UserDocument } from '../../../types';
import { MongoDB, validateToken, userExistsLogic } from '../../../util';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const MAX_TEAM_SIZE = 4;

const teamInvite: ValidatedEventAPIGatewayProxyEvent<typeof schema> = async (event) => {
  // Alias snake_case request fields to camelCase locals to satisfy naming-convention
  const { auth_token: authToken, auth_email: authEmail, team_id: teamId, emails } = event.body;

  // auth check
  if (!validateToken(authToken, process.env.JWT_SECRET!, authEmail)) {
    return {
      statusCode: 401,
      body: JSON.stringify({ message: 'Unauthorized' }),
    };
  }

  // DB setup
  const db = MongoDB.getInstance(process.env.MONGO_URI!);
  await db.connect();
  const client = db.getClient();
  const users = db.getCollection<UserDocument>('users');
  const teams = db.getCollection<TeamDocument>('teams');

  // verify auth user
  const authUser = await users.findOne({ email: authEmail });
  if (!authUser) {
    return {
      statusCode: 404,
      body: JSON.stringify({ message: 'Auth user not found' }),
    };
  }

  // verify team & leadership
  const team = await teams.findOne({ team_id: teamId });
  if (!team) {
    return {
      statusCode: 404,
      body: JSON.stringify({ message: 'Team not found' }),
    };
  }
  if (team.leader_email !== authEmail) {
    return {
      statusCode: 403,
      body: JSON.stringify({ message: 'Auth user is not the team leader' }),
    };
  }

  // check team status
  if (team.status !== 'Active') {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Team is not active' }),
    };
  }

  // capacity check
  const confirmedCount = (Array.isArray(team.members) ? team.members.length : 0) + 1; // + 1 for the leader
  const pendingCount = await users.countDocuments({
    'team_info.pending_invites.team_id': teamId,
  });
  const availableSlots = MAX_TEAM_SIZE - confirmedCount - pendingCount;
  if (availableSlots <= 0) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Team is already full' }),
    };
  }

  const invited: string[] = [];
  const failed: Failure[] = [];

  // use a transaction for all updates
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      const uniqueEmails = Array.from(new Set(emails));

      for (const email of uniqueEmails) {
        // stop when no slots remain
        if (invited.length >= availableSlots) {
          failed.push({ email, reason: 'No slots remaining' });
          continue;
        }

        // check user exists via util
        const { statusCode: uxStatus } = await userExistsLogic(authEmail, authToken, email);
        if (uxStatus !== 200) {
          failed.push({ email, reason: 'User does not exist or unauthorized' });
          continue;
        }

        // load user within transaction
        const user = await users.findOne({ email }, { session });
        if (!user) {
          failed.push({ email, reason: 'User record not found' });
          continue;
        }

        // prevent users already on a team
        if (user.confirmed_team) {
          failed.push({ email, reason: 'Already a confirmed team member' });
          continue;
        }

        // prevent duplicate invites (type the pending list instead of using any)
        const pending = (user.team_info?.pending_invites ?? []) as TeamInvite[];
        if (pending.some((inv) => inv.team_id === teamId)) {
          failed.push({ email, reason: 'Already invited to this team' });
          continue;
        }

        // all checks pass -> enqueue invite
        await users.updateOne(
          { email },
          {
            $push: {
              'team_info.pending_invites': {
                team_id: teamId,
                invited_by: authEmail,
                invited_at: new Date(),
                team_name: team.team_name,
              } as TeamInvite,
            },
          },
          { session }
        );
        invited.push(email);
      }
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Transaction aborted:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Internal server error during invitation processing',
      }),
    };
  } finally {
    await session.endSession();
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Invitations sent successfully',
      invited,
      failed,
    }),
  };
};

export const main = middyfy(teamInvite);
