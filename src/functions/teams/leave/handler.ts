import type { ValidatedEventAPIGatewayProxyEvent } from '@libs/api-gateway';
import { middyfy } from '@libs/lambda';
import schema from './schema';
import { UserDocument, TeamDocument } from '../../../types';
import { MongoDB, validateToken, disbandTeam } from '../../../util'; //change to actual disband
import * as path from 'path';
import * as dotenv from 'dotenv';

//import fetch from 'node-fetch';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const teamLeave: ValidatedEventAPIGatewayProxyEvent<typeof schema> = async (event) => {
  try {
    const { auth_token, auth_email, team_id } = event.body;

    // 1. Validate auth token
    const tokenValid = validateToken(auth_token, process.env.JWT_SECRET, auth_email);
    if (!tokenValid) {
      return {
        statusCode: 401,
        body: JSON.stringify({ statusCode: 401, message: 'Unauthorized' }),
      };
    }

    // 2. connect to mongoDB
    const db = MongoDB.getInstance(process.env.MONGO_URI);
    await db.connect();
    const users = db.getCollection<UserDocument>('users');
    const teams = db.getCollection<TeamDocument>('teams');

    // 3. check if user exisits
    const authUser = await users.findOne({ email: auth_email });
    if (!authUser) {
      return {
        statusCode: 404,
        body: JSON.stringify({ statusCode: 404, message: 'Auth user not found' }),
      };
    }

    // 4. check if team exisits
    const team = await teams.findOne({ team_id: team_id });
    if (!team) {
      return {
        statusCode: 404,
        body: JSON.stringify({ statusCode: 404, message: 'Team not found' }),
      };
    }

    // 5. Check if team is disbanded
    if (team.status == 'Disbanded') {
      return {
        statusCode: 400,
        body: JSON.stringify({ statusCode: 400, message: 'Team already disbanded' }),
      };
    }

    // 6. No team members
    if (team.members.length == 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ statusCode: 400, message: 'Empty team member list' }),
      };
    }

    // 7. Check if user is in team
    if (!team.members.includes(auth_email)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ statusCode: 400, message: 'User not in team' }),
      };
    }

    //grabs team info object
    const teamInfo = authUser.team_info;

    // 8. Check if user is team lead
    if (teamInfo.role == 'leader') {
      return await disbandTeam(auth_token, auth_email, team_id);
    }

    // 9. Remove user from team
    await teams.updateOne(
      { team_id: team_id, members: authUser.email },
      {
        $pull: {
          members: authUser.email,
        },
      }
    );

    // 10. clear team_info and set confirmed_team

    authUser.confirmed_team = false;
    authUser.team_info = {
      team_id: '',
      role: null,
      pending_invites: [],
    };

    // 11. update the MongoDB user
    await users.updateOne(
      { email: auth_email },
      {
        $set: {
          confirmed_team: authUser.confirmed_team,
          team_info: authUser.team_info,
        },
      }
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Successfully left team' }),
    };
  } catch (error) {
    console.error('Error deleting team member:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ statusCode: 500, message: 'Internal server error' }),
    };
  }
};

export const main = middyfy(teamLeave);
