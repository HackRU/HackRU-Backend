/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-undef */
const request = require('supertest');

const testCases = [
  {
    description: 'valid email and password',
    userData: { email: 'test@test.com', password: 'test' },
    expectedStatus: 200,
    expectedMessage: 'Authentication Successful',
  },
  {
    description: 'invalid email and n/a password',
    userData: { email: 'invalidtest@test.com', password: 'test' },
    expectedStatus: 403,
    expectedMessage: 'Invalid email',
  },
  {
    description: 'valid email, invalid password',
    userData: { email: 'test@test.com', password: 'nfdjklsafnjkldsaf' },
    expectedStatus: 403,
    expectedMessage: 'Wrong password',
  },
];

describe('/Authorize Tests', () => {
  testCases.forEach(({ description, userData, expectedStatus, expectedMessage }) => {
    test(description, async () => {
      const response = await request('http://localhost:3000')
        .post('/dev/authorize')
        .send(userData)
        .set('Content-Type', 'application/json');

      expect(response.statusCode).toBe(expectedStatus);
      expect(response.body.message).toBe(expectedMessage)
      console.log(response.body);
    });
  });
});
