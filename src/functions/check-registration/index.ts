import { handlerPath } from '@libs/handler-resolver';
import schema from './schema';

export default {
  handler: `${handlerPath(__dirname)}/handler.main`,
  events: [
    {
      http: {
        method: 'post',
<<<<<<< HEAD:src/functions/check_registration/index.ts
        path: 'check_registration',
        cors: true,
=======
        path: 'check-registration',
>>>>>>> dev:src/functions/check-registration/index.ts
        request: {
          schemas: {
            'application/json': schema,
          },
        },
      },
    },
  ],
};
