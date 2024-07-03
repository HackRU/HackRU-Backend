export default {
  type: 'object',
  properties: {
    auth_email: { type: 'string' },
    token: { type: 'string' },
    email: { type: 'string' },
  },
  required: ['auth_email', 'token', 'email'],
} as const;
