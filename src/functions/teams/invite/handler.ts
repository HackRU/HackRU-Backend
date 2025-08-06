// src/functions/teams/invite/handler.ts
import * as dotenv from 'dotenv';
import * as path from 'path';
import type { ValidatedEventAPIGatewayProxyEvent } from '@libs/api-gateway';
import { middyfy } from '@libs/lambda';
import schema from './schema';
import { MongoDB, validateToken, userExistsLogic } from '../../../util';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const MAX_TEAM_SIZE = 4;

interface Failure {
  email: string;
  reason: string;
}

const teamInvite: ValidatedEventAPIGatewayProxyEvent<typeof schema> = async (event) => {
  const { auth_token, auth_email, team_id, emails } = event.body;

  // auth check
  if (!validateToken(auth_token, process.env.JWT_SECRET!, auth_email)) {
    return {
      statusCode: 401,
      body: JSON.stringify({ message: 'Unauthorized' }),
    };
  }

  // DB setup
  const db = MongoDB.getInstance(process.env.MONGO_URI!);
  await db.connect();
  const client = db.getClient();
  const users = db.getCollection('users');
  const teams = db.getCollection('teams');

  // verify auth user
  const authUser = await users.findOne({ email: auth_email });
  if (!authUser) {
    return {
      statusCode: 404,
      body: JSON.stringify({ message: 'Auth user not found' }),
    };
  }

  // verify team & leadership
  const team = await teams.findOne({ team_id });
  if (!team) {
    return {
      statusCode: 404,
      body: JSON.stringify({ message: 'Team not found' }),
    };
  }
  if (team.leader_email !== auth_email) {
    return {
      statusCode: 403,
      body: JSON.stringify({ message: 'Auth user is not the team leader' }),
    };
  }

  // capacity check
  const confirmedCount = Array.isArray(team.members) ? team.members.length : 0;
  const pendingCount = await users.countDocuments({
    'team_info.pending_invites.team_id': team_id,
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
        const { statusCode: uxStatus } = await userExistsLogic(auth_email, auth_token, email);
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

        // prevent duplicate invites
        const pending = user.team_info?.pending_invites ?? [];
        if (pending.some((inv: any) => inv.team_id === team_id)) {
          failed.push({ email, reason: 'Already invited to this team' });
          continue;
        }

        // all checks pass -> enqueue invite
        await users.updateOne(
          { email },
          {
            $push: {
              'team_info.pending_invites': {
                team_id,
                invited_by: auth_email,
                invited_at: new Date(),
              },
            },
          },
          { session }
        );
        invited.push(email);
      }
    });
  } catch (err) {
    console.error('Transaction aborted:', err);
    // if the transaction as a whole fails, treat everyone as failed
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Internal server error during invitation processing',
      }),
    };
  } finally {
    session.endSession();
  }

  // return success
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
