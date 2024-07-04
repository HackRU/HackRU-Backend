export default {
  type: 'object',
  properties: {
    auth_email: { type: 'string', format: 'email' },
    auth_token: { type: 'string' },
    email: { type: 'string', format: 'email' },
  },
  required: ['auth_email', 'auth_token', 'email'],
} as const;
