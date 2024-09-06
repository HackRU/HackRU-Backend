export default {
  type: 'object',
  properties: {
    auth_email: { type: 'string', format: 'email' },
    auth_token: { type: 'string' },
    hacker_email: { type: 'string', format: 'email' },
    amount: { type: 'number' },
  },
  required: ['auth_email', 'auth_token', 'hacker_email', 'amount'],
} as const;
