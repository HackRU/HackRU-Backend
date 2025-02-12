export default {
  type: 'object',
  properties: {
    auth_email: { type: 'string', format: 'email' },
    auth_token: { type: 'string' },
    qr: { type: 'string', format: 'email' },
    event: { type: 'string' },
    points: { type: 'number' },
    limit: { type: 'number' },
  },
  required: ['auth_email', 'auth_token', 'qr', 'event', 'limit'],
} as const;
