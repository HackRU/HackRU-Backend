import type { ValidatedEventAPIGatewayProxyEvent } from '@libs/api-gateway';
import { middyfy } from '@libs/lambda';
import schema from './schema';
import { teamInviteLogic } from '../../../util';

const teamInvite: ValidatedEventAPIGatewayProxyEvent<typeof schema> = async (event) => {
  const { auth_token: authToken, auth_email: authEmail, team_id: teamId, emails } = event.body;
  return teamInviteLogic(authEmail, authToken, teamId, emails);
};

export const main = middyfy(teamInvite);
