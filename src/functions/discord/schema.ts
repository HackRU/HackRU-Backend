export default {
  type: 'object',
  properties: {
    email: { type: 'string', format: 'email' },
    auth_token: { type: 'string' },
    code: { type: 'string' },
  },
  required: ['email', 'auth_token', 'code'],
} as const;
