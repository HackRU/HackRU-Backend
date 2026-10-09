import type { ValidatedEventAPIGatewayProxyEvent } from '@libs/api-gateway';
import { middyfy } from '@libs/lambda';
import schema from './schema';
import { ensureRoles, MongoDB, validateToken } from '../../util';

const points: ValidatedEventAPIGatewayProxyEvent<typeof schema> = async (event) => {
  const email = event.body.email.toLowerCase();
  // older frontends omit auth_email and only ever read their own points
  const authEmail = (event.body.auth_email ?? event.body.email).toLowerCase();

  try {
    // check token
    const isValidToken = validateToken(event.body.auth_token, process.env.JWT_SECRET, authEmail);
    if (!isValidToken) {
      return {
        statusCode: 401,
        body: JSON.stringify({ statusCode: 401, message: 'Unauthorized' }),
      };
    }

    // Connect to DB
    const db = MongoDB.getInstance(process.env.MONGO_URI);
    await db.connect();
    const users = db.getCollection('users');
    const pointsCollection = db.getCollection('f26-points');

    // ensure that auth user can only have role director or organizer
    const authUser = await users.findOne({ email: authEmail });
    if (authUser) {
      if (!ensureRoles(authUser.role, ['director', 'organizer']) && email !== authEmail) {
        return {
          statusCode: 401,
          body: JSON.stringify({
            statusCode: 401,
            message: 'Unauthorized. Auth user is not an organizer/director.',
          }),
        };
      }
    } else {
      return {
        statusCode: 404,
        body: JSON.stringify({ statusCode: 404, message: 'Auth user not found.' }),
      };
    }

    // Make sure user exists
    const user = await users.findOne({ email: email });
    if (!user) {
      return {
        statusCode: 404,
        body: JSON.stringify({ statusCode: 404, message: 'User not found.' }),
      };
    }

    // get users points

    const pointUser = await pointsCollection.findOne(
      { email: email },
      // eslint-disable-next-line @typescript-eslint/naming-convention
      { projection: { _id: 0, balance: 1, total_points: 1, buy_ins: 1 } }
    );

    // no points doc yet means nothing earned this season
    const buyIns = Array.isArray(pointUser?.buy_ins) ? pointUser.buy_ins : [];

    return {
      statusCode: 200,
      body: JSON.stringify({
        statusCode: 200,
        balance: pointUser?.balance ?? 0,
        total_points: pointUser?.total_points ?? 0,
        buy_ins: buyIns,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ statusCode: 500, message: 'Internal server error.', error }),
    };
  }
};

export const main = middyfy(points);
