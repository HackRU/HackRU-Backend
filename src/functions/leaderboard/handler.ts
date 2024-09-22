import { APIGatewayProxyHandler } from 'aws-lambda';
import { middyfy } from '@libs/lambda';
import { MongoDB } from '../../util';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const leaderboard: APIGatewayProxyHandler = async () => {
  try {
    const db = MongoDB.getInstance(process.env.MONGO_URI);
    await db.connect();
    const points = db.getCollection('f24-points-syst');

    const topPlayers = await points
      .aggregate([
        {
          $project: {
            name: 1,
            total_points: 1,
          },
        },
        {
          $sort: { total_points: -1 },
        },
        {
          $limit: 20,
        },
      ])
      .toArray();

    return {
      statusCode: 200,
      body: JSON.stringify(topPlayers),
    };
  } catch (error) {
    console.error('Error loading top 20', error);
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

export const main = middyfy(leaderboard);
