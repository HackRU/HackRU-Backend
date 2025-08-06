export default {
  type: 'object',
  properties: {
    auth_token: { type: 'string' },
    auth_email: { type: 'string', format: 'email' },
    team_id: {type:"string"}
  },
  required: ['auth_token', 'auth_email', 'team_id'],
} as const;
