export default {
  type: 'object',
  properties: {
    user_email: { type: 'string', format: 'email' },
    auth_email: { type: 'string', format: 'email' },
    auth_token: { type: 'string' },
  },
  required: ['user_email', 'auth_token', 'auth_email'],
} as const;
