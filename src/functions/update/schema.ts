export default {
  type: 'object',
  properties: {
    user_email: { type: 'string', format: 'email' },
    auth_email: { type: 'string', format: 'email' },
    auth_token: { type: 'string' },
    updates: {
      type: 'object',
      properties: {
        $set: { type: 'object' },
        $inc: {
          type: 'object',
          properties: {
            votes: { type: 'number' },
            day_of: {
              type: 'object',
              additionalProperties: {
                type: 'number',
              },
            },
          },
          $push: {
            type: 'object',
            properties: {
              votes_from: { type: 'string', format: 'email' },
            },
          },
        },
      },
    },
    required: ['user_email', 'auth_email', 'auth_token', 'updates'],
  },
} as const;
