/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-undef */

/* Alt version of authorize.test.tsx
  This version requires "npx serverless offline" to be running
  Just use "npm test" to run test
*/
const request = require('supertest');

const serverUrl = process.env.SERVER_URL || 'http://localhost:3000';

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
      const response = await request(serverUrl)
        .post('/dev/authorize')
        .send(userData)
        .set('Content-Type', 'application/json');

      expect(response.statusCode).toBe(expectedStatus);
      expect(response.body.message).toBe(expectedMessage);
    });
  });
});
