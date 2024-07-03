export default {
  type: 'object',
  properties: {
    email: { type: 'string', format: 'email' },
    token: { type: 'string' },
    query: {
      oneOf: [
        {
          type: 'object',
          additionalProperties: true,
        },
        {
          type: 'array',
          items: { type: 'string' },
        },
      ],
    },
    aggregate: { type: 'boolean', default: false },
    just_here: { type: 'boolean', default: false },
  },
  required: ['email', 'token', 'query'],
} as const;
