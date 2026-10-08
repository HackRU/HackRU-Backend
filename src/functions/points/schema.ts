export default {
  type: 'object',
  properties: {
    auth_token: { type: 'string' },
    auth_email: { type: 'string', format: 'email' },
    email: { type: 'string', format: 'email' },
  },
  required: ['auth_token', 'auth_email', 'email'],
} as const;
