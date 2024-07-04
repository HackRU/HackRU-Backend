export default {
  type: 'object',
  properties: {
    email: { type: 'string', format: 'email' },
    auth_token: { type: 'string' },
  },
  required: ['email', 'auth_token'],
} as const;
