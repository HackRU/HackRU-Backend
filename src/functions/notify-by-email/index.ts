import { handlerPath } from '@libs/handler-resolver';

export default { handler: `${handlerPath(__dirname)}/handler.main`, events: [{ sns: process.env.SNS_TOPIC_ARN }] };
