import { handlerPath } from '@libs/handler-resolver';

export default {
  handler: `${handlerPath(__dirname)}/handler.main`,
  environment: {

  },
  events: [
    {
      sns: {
        arn: process.env.SNS_TOPIC_ARN,
        topicName: 'registration-status-update',
      },
    },
  ],
};
