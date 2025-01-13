import { handlerPath } from '@libs/handler-resolver';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export default {
  handler: `${handlerPath(__dirname)}/handler.main`,
  events: [
    {
      sns: process.env.SNS_TOPIC_ARN,
    },
  ],
};
