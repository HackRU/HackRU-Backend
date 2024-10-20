export default {
  type: 'object',
  properties: {
    auth_token: { type: 'string' },
    email: { type: 'string', format: 'email' },
  },
  required: ['auth_token', 'email'],
} as const;
