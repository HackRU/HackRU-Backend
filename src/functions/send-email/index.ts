import { handlerPath } from '@libs/handler-resolver';

export default {
  handler: `${handlerPath(__dirname)}/handler.main`,
  environment: {
    SENDER_EMAIL: process.env.SENDER_EMAIL,
  },
  events: [
    {
      sns: {
        arn: process.env.SNS_TOPIC_ARN,
        topicName: 'registration-status-update'
      }
    }
  ]
};