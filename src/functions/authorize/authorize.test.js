/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-undef */
const request = require('supertest');

const userauthdata = {
  email: 'test@test.com',
  password: 'test'
}

request('http://localhost:3000')
  .post('/dev/authorize')
  .send(userauthdata)
  .set('Content-Type', 'application/json')
  .end(function (err, res) {
    if (err) throw err;
    console.log(res.body);
  });
