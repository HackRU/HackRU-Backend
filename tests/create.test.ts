import { main } from '../src/functions/create/handler';
import { createEvent, mockContext } from './helper';

import * as bcrypt from 'bcryptjs';
jest.mock('bcryptjs');

//mock the db route
jest.mock('../src/util', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention
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
  registrationEnd: '12/31/2099',
}));

describe('Create endpoint', () => {
  it('Duplicate User', async () => {
    const mockEvent = createEvent({ email: 'testEmail@gmail.com', password: 'testPassword123' }, '/create', 'POST');

    const mockCallback = jest.fn();

    (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');

    const res = await main(mockEvent, mockContext, mockCallback);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).message).toBe('Duplicate user!');
  });
  it('Create a new user', async () => {
    const mockEvent = createEvent({ email: 'testEmail@gmail.com', password: 'testPassword123' }, '/create', 'POST');

    const mockCallback = jest.fn();

    (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
    const res = await main(mockEvent, mockContext, mockCallback);

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).message).toBe('User created!');
  });
  it('Registration time has passed', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('01/01/2100'));

    const mockEvent = createEvent({ email: 'testEmail@gmail.com', password: 'testPassword123' }, '/create', 'POST');
    const mockCallback = jest.fn();
    const res = await main(mockEvent, mockContext, mockCallback);

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).message).toBe('Registration is closed!');
  });
});
