import type { ValidatedEventAPIGatewayProxyEvent } from '@libs/api-gateway';
import { middyfy } from '@libs/lambda';
import schema from './schema';
import { MongoDB, validateToken } from '../../../util';
import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const USER_SERVICE_URL = process.env.USER_SERVICE_URL!;
const MAX_TEAM_SIZE = 4;

const teamInvite: ValidatedEventAPIGatewayProxyEvent<typeof schema> = async (event) => {
  try {
    const { auth_token, auth_email, team_id, emails } = event.body;

    // auth check
    if (!validateToken(auth_token, process.env.JWT_SECRET!, auth_email)) {
      return { statusCode: 401, body: JSON.stringify({ message: 'Unauthorized' }) };
    }

    // connect to Mongo
    const db = MongoDB.getInstance(process.env.MONGO_URI!);
    await db.connect();
    const users = db.getCollection('users');
    const teams = db.getCollection('teams');

    // verify auth user exists
    const authUser = await users.findOne({ email: auth_email });
    if (!authUser) {
      return { statusCode: 404, body: JSON.stringify({ message: 'Auth user not found' }) };
    }

    // verify team exists & leadership
    const team = await teams.findOne({ team_id });
    if (!team) {
      return { statusCode: 404, body: JSON.stringify({ message: 'Team not found' }) };
    }
    if (team.leader_email !== auth_email) {
      return { statusCode: 403, body: JSON.stringify({ message: 'Auth user is not the team leader' }) };
    }

    // capacity check (confirmed + pending)
    const confirmedCount = Array.isArray(team.members) ? team.members.length : 0;
    const pendingCount = await users.countDocuments({
      'team_info.pending_invites.team_id': team_id,
    });
    const availableSlots = MAX_TEAM_SIZE - confirmedCount - pendingCount;
    if (availableSlots <= 0) {
      return { statusCode: 400, body: JSON.stringify({ message: 'Team is already full' }) };
    }

    const invited: string[] = [];
    const failed: string[] = [];

    // loop over each email
    for (const email of emails) {
      // If we’ve filled all slots, everyone else fails
      if (invited.length >= availableSlots) {
        failed.push(email);
        continue;
      }

      // user-exists microservice
      let exists = false;
      try {
        const res = await axios.post(`${USER_SERVICE_URL}/user-exists`, { email });
        exists = res.data.exists;
      } catch {
        // service down or invalid response
        failed.push(email);
        continue;
      }
      if (!exists) {
        failed.push(email);
        continue;
      }

      // fetch user doc
      const user = await users.findOne({ email });
      if (!user) {
        failed.push(email);
        continue;
      }

      // already confirmed?
      if (user.confirmed_team) {
        failed.push(email);
        continue;
      }

      // already invited?
      const pendingInvites = user.team_info?.pending_invites ?? [];
      if (pendingInvites.some((inv) => inv.team_id === team_id)) {
        failed.push(email);
        continue;
      }

      // all checks pass → add to pending_invites
      const invite = {
        team_id,
        invited_by: auth_email,
        invited_at: new Date(),
      };
      await users.updateOne({ email }, { $push: { 'team_info.pending_invites': invite } });
      invited.push(email);
    }

    // return final status
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Invitations processed',
        invited,
        failed,
      }),
    };
  } catch (error) {
    console.error('Error in /teams/invite:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal server error' }),
    };
  }
};

export const main = middyfy(teamInvite);
