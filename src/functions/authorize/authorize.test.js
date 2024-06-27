/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-undef */
const request = require('supertest');

// valid user: email is good, password is good
const validUser = {
  email: 'test@test.com', // valid
  password: 'test', // valid
};

// invalid user case 1: email is invalid, password is good
const invalidUser1 = {
  email: 'invalidtest@test.com', // invalid
  password: 'test', // valid
};

// invalid user case 1: email is invalid, password is invalid
const invalidUser2 = {
  email: 'invalidtest@test.com', // invalid
  password: 'hnjfjdklsafnkdjlsanfljdsajf', // invalid
};

// invalid user case 1: email is invalid, password is bad
const invalidUser3 = {
  email: 'test@test.com', // valid
  password: 'nfdjklsafnjkldsaf', // invalid
};

describe('Authorization Tests', () => {
  test('should validate user authorization', async () => {
    const response = await request('http://localhost:3000')
      .post('/dev/authorize')
      .send(validUser)
      .set('Content-Type', 'application/json');

    expect(response.statusCode).toBe(200);
    console.log(response.body);
  });

  test('should not validate user because of invalid email ', async () => {
    const response = await request('http://localhost:3000')
      .post('/dev/authorize')
      .send(invalidUser1)
      .set('Content-Type', 'application/json');

    expect(response.statusCode).toBe(403);
    console.log(response.body);
  });

  test('should not validate user because of invalid email and password', async () => {
    const response = await request('http://localhost:3000')
      .post('/dev/authorize')
      .send(invalidUser2)
      .set('Content-Type', 'application/json');

    expect(response.statusCode).toBe(403);
    console.log(response.body);
  });

  test('should not validate user because of invalid password but email is good ', async () => {
    const response = await request('http://localhost:3000')
      .post('/dev/authorize')
      .send(invalidUser3)
      .set('Content-Type', 'application/json');

    expect(response.statusCode).toBe(403);
    console.log(response.body);
  });
});
