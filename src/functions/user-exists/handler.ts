import type { ValidatedEventAPIGatewayProxyEvent } from '@libs/api-gateway';
import { middyfy } from '@libs/lambda';
import schema from './schema';
import { userExistsLogic } from '../../util';

const userExists: ValidatedEventAPIGatewayProxyEvent<typeof schema> = async (event) => {
  return userExistsLogic(event.body.auth_email, event.body.auth_token, event.body.email);
};
export const main = middyfy(userExists);
