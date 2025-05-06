export default {
  type: 'object',
  properties: {
    email: { type: 'string', format: 'email' },
    auth_email: { type: 'string', format: 'email' },
    auth_token: { type: 'string' },
  },
  required: ['email', 'auth_token', 'auth_email']
} as const;
