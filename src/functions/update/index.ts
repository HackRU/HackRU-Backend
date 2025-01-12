import { handlerPath } from '@libs/handler-resolver';
import * as path from 'path';
import schema from './schema';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export default {
  handler: `${handlerPath(__dirname)}/handler.main`,
  environment: {
    SNS_TOPIC_ARN: process.env.SNS_TOPIC_ARN,
  },
  events: [
    {
      http: {
        method: 'post',
        path: 'update',
        cors: true,
        request: {
          schemas: {
            'application/json': schema,
          },
        },
      },
    },
  ],
};
