import type { ValidatedEventAPIGatewayProxyEvent } from '@libs/api-gateway';
import { middyfy } from '@libs/lambda';

import schema from './schema';

import { MongoDB, validateToken } from '../../util';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const updateBuyIns: ValidatedEventAPIGatewayProxyEvent<typeof schema> = async (event) => {
  try {
    // validate auth token
    const validToken = validateToken(event.body.auth_token, process.env.JWT_SECRET, event.body.email);
    if (!validToken) {
      return {
        statusCode: 401,
        body: JSON.stringify({
          statusCode: 401,
          message: 'Unauthorized',
        }),
      };
    }

    // connect to DB
    const db = MongoDB.getInstance(process.env.MONGO_URI);
    await db.connect();
    const point_collection = db.getCollection('f24-points-syst');
    const userPoints = await point_collection.findOne({ email: event.body.email });

    if (userPoints) {
      const userBuyInsSorted = userPoints.buy_ins.sort((a, b) => b.prize_id.localeCompare(a.prize_id));
      const requestBuyInsSorted = event.body.buy_ins.sort((a, b) => b.prize_id.localeCompare(a.prize_id));
      if (userBuyInsSorted.length === requestBuyInsSorted.length) {
        let points_used = 0;
        for (let i = 0; i < userBuyInsSorted.length; i++) {
          if (requestBuyInsSorted[i].prize_id !== userBuyInsSorted[i].prize_id) {
            return {
              statusCode: 400,
              body: JSON.stringify({
                statusCode: 400,
                message: 'Request body prizes do not match',
              }),
            };
          }
          points_used += event.body.buy_ins[i].buy_in;
        }
        if (points_used > userPoints.total_points) {
          return {
            statusCode: 403,
            body: JSON.stringify({
              statusCode: 403,
              message: 'Points distributed exceed user point total.',
            }),
          };
        }

        await point_collection.updateOne({ email: event.body.email }, { $set: { buy_ins: event.body.buy_ins } });
        return {
          statusCode: 200,
          body: JSON.stringify({
            statusCode: 200,
            message: 'Updated user point balance successfully',
          }),
        };
      } else {
        return {
          statusCode: 404,
          body: JSON.stringify({
            statusCode: 404,
            message: 'User point balance information not found',
          }),
        };
      }
    }
  } catch (error) {
    console.error('Error updating', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        statusCode: 500,
        message: 'Internal server error',
        error,
      }),
    };
  }
};

export const main = middyfy(updateBuyIns);
