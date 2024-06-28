import { main } from '../src/functions/create/handler';
import { createEvent, mockContext } from './helper';

const bcrypt = require('bcryptjs');
jest.mock('bcryptjs');

//mock the db route
jest.mock('../src/util', () => ({
  MongoDB: {
    getInstance: jest.fn().mockReturnValue({
      connect: jest.fn(),
      disconnect: jest.fn(),

      getCollection: jest.fn().mockReturnValue({
        findOne: jest.fn().mockReturnValueOnce({ email: 'test@test.org', password: 'test' }).mockReturnValue(null),
        insertOne: jest.fn(),
      }),
    }),
  },
}));

jest.mock('../src/config.ts', () => ({
  registrationStart: '06/02/2024',
  registrationEnd: '06/30/2024',
}));

describe('Create endpoint', () => {
  it('Duplicate User', async () => {
    const mockEvent = createEvent({ email: 'testEmail@gmail.com', password: 'testPassword123' }, '/create', 'POST');

    const mockCallback = jest.fn();

    bcrypt.hash.mockResolvedValue('hashedPassword');

    const res = await main(mockEvent, mockContext, mockCallback);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).message).toBe('Duplicate user!');
  });
  it('Create a new user', async () => {
    const mockEvent = createEvent({ email: 'testEmail@gmail.com', password: 'testPassword123' }, '/create', 'POST');

    const mockCallback = jest.fn();

    bcrypt.hash.mockResolvedValue('hashedPassword');
    const res = await main(mockEvent, mockContext, mockCallback);

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).message).toBe('User created!');
  });
  it('Registration time has passed', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('07/01/2024'));

    const mockEvent = createEvent({ email: 'testEmail@gmail.com', password: 'testPassword123' }, '/create', 'POST');
    const mockCallback = jest.fn();
    const res = await main(mockEvent, mockContext, mockCallback);

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).message).toBe('Registration is closed!');
  });
});
