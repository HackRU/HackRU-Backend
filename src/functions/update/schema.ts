export default {
  type: 'object',
  properties: {
    user_email: { type: 'string', format: 'email' },
    auth_email: { type: 'string', format: 'email' },
    auth_token: { type: 'string' },
    updates: {
      type: 'object',
      properties: {
        $set: {
          type: 'object',
          additionalProperties: {
            type: ['boolean', 'string', 'number'],
          },
        },
      },
    },
  },
  required: ['user_email', 'auth_email', 'auth_token', 'updates'],
} as const;
