export default {
    type: "object",
    properties: {
        auth_email: { type: 'string' },
        token: { type: 'string' },
        qr: { type: 'string' },
        event: { type: ' string'},
        again: { type: 'boolean'},
        email: { type: 'string'}
    },
    required: ['email']
  } as const;