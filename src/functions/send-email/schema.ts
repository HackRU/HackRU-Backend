export default {
  type: 'object',
  properties: {
    Records: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          Sns: {
            type: 'object',
            properties: {
              Message: {
                type: 'string',
                description: 'Contains a JSON string with email, first_name, last_name, and registration_status'
              }
            },
            required: ['Message']
          }
        },
        required: ['Sns']
      }
    }
  },
  required: ['Records']
} as const;