export default {
  type: 'object',
  properties: {
    email: { type: 'string', format: 'email' },
    auth_token: { type: 'string ' },
    buy_ins: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          prize_id: { type: 'string' },
          buy_in: { type: 'number' },
        },
        required: ['prize_id', 'buy_in'],
      },
    },
  },
  required: ['email', 'auth_token', 'buy_ins'],
} as const;
