export default {
    type: "object",
    properties: {
        auth_email: { type: 'string' },
        token: { type: 'string' },
        qr: { type: 'string' },
        event: { type: ' string'},
        again: { type: 'boolean'}
    },
    required: ['qr', 'token', 'event']
  } as const;