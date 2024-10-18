import type { ValidatedEventAPIGatewayProxyEvent } from '@libs/api-gateway';
import { middyfy } from '@libs/lambda';
import schema from './schema';
import { MongoDB, validateToken } from '../../util';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const getBuyIns: ValidatedEventAPIGatewayProxyEvent<typeof schema> = async (event) => {
  const email = event.body.email.toLowerCase();

  try {
    // check token
    const isValidToken = validateToken(event.body.auth_token, process.env.JWT_SECRET, email);
    if (!isValidToken) {
      return {
        statusCode: 401,
        body: JSON.stringify({
          statusCode: 401,
          message: 'Unauthorized',
        }),
      };
    }

    // Connect to DB
    const db = MongoDB.getInstance(process.env.MONGO_URI);
    await db.connect();
    const points = db.getCollection('f24-points-syst');

    const buyIns = await points
      .aggregate([
        { $unwind: '$buy_ins' },
        // eslint-disable-next-line @typescript-eslint/naming-convention
        { $group: { _id: '$buy_ins.prize_id', sum: { $sum: '$buy_ins.buy_in' } } },
      ])
      .toArray();

    const result = {};
    buyIns.forEach((buyIn) => {
      result[buyIn._id] = buyIn.sum;
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        statusCode: 200,
        buyIns: result,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        statusCode: 500,
        message: 'Internal Server Error',
        error,
      }),
    };
  }
};

export const main = middyfy(getBuyIns);
