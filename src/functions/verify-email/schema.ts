export default {
  type: 'object',
  properties: {
    email: { type: 'string', format: 'email' },
    auth_token: { type: 'string' },
    code: { type: 'string' },
  },
  oneOf: [{ required: ['code'] }, { required: ['email', 'auth_token'] }],
} as const;
