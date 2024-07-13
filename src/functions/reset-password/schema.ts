export default {
  type: 'object',
  properties: {
    email: { type: 'string', format: 'email' },
    reset_token: { type: 'string' },
    new_password: { type: 'string' },
  },
  required: ['email', 'reset_token', 'new_password'],
} as const;
