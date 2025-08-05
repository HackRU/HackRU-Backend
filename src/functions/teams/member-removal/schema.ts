export default {
  type: 'object',
  properties: {
    auth_token: { type: 'string' },
    auth_email: { type: 'string', format: 'email' },
    team_id: { type: 'string' },
    member_emails: {
      type: 'array',
      items: { type: 'string', format: 'email' },
      minItems: 1,
    },
  },
  required: ['auth_token', 'auth_email', 'team_id', 'member_emails'],
} as const;
