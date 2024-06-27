/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-undef */
const request = require('supertest');

const userauthdata = {
  email: 'test@test.com',
  password: 'test',
};

describe('Authorization Tests', () => {
  test('should validate user authorization', async () => {
    const response = await request('http://localhost:3000')
      .post('/dev/authorize')
      .send(userauthdata)
      .set('Content-Type', 'application/json');

    expect(response.statusCode).toBe(200); // Adjust based on your expected status code
    console.log(response.body);
  });
});
