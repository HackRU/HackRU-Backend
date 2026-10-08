import { handlerPath } from '@libs/handler-resolver';
import schema from './schema';

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
