export default {
  type: 'object',
  properties: {
    auth_token: { type: 'string' },
    auth_email: { type: 'string', format: 'email' },
    team_name: { type: 'string' },
    members: {
      type: 'array',
      items: { type: 'string', format: 'email' },
      maxItems: 3,
    },
  },
  required: ['auth_token', 'auth_email', 'team_name', 'members'],
} as const;
