export default {
  type: 'object',
  properties: {
    authToken: { type: 'string' },
    authEmail: { type: 'string', format: 'email' },
    teamId: { type: 'string' },
  },
  required: ['authToken', 'authEmail', 'teamId'],
} as const;
