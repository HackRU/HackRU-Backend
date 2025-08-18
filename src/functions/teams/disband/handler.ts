import type { ValidatedEventAPIGatewayProxyEvent } from '@libs/api-gateway';
import { middyfy } from '@libs/lambda';

import schema from './schema';

import { disbandTeam } from '../../../util';

const disband: ValidatedEventAPIGatewayProxyEvent<typeof schema> = async (event) => {
  return disbandTeam(event.body.auth_token, event.body.auth_email, event.body.team_id);
};
export const main = middyfy(disband);
