export default {
  type: 'object',
  properties: {
    auth_token: { type: 'string' },
    auth_email: { type: 'string', format: 'email' },
    team_id: { type: 'string' },
    member_email: { type: 'string', format: 'email' },
  },
  oneOf: [
    { required: ['auth_token', 'auth_email', 'team_id'] },
    { required: ['auth_token', 'auth_email', 'member_email'] },
  ],
} as const;
