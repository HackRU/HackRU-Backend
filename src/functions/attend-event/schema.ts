export default {
  type: 'object',
  properties: {
    auth_email: { type: 'string', format: 'email'},
    token: { type: 'string' },
    qr: { type: 'string' },
    event: { type: ' string' },
    again: { type: 'boolean' },
  },
  required: ['auth_email', 'qr', 'token', 'event'],
} as const;
