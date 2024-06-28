// authorize.test.ts

import { main } from '../src/functions/authorize/handler';
import { createEvent, mockContext } from './helper';

import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';

jest.mock('jsonwebtoken');
jest.mock('bcryptjs');

jest.mock('../src/util', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention
  MongoDB: {
    getInstance: jest.fn().mockReturnValue({
      connect: jest.fn(),
      disconnect: jest.fn(),
      getCollection: jest.fn().mockReturnValue({
        findOne: jest.fn().mockReturnValueOnce(null).mockReturnValue({ email: 'test@test.org', password: 'test' }),
      }),
    }),
  },
}));

describe('Authorization tests', () => {
  const path = '/authorize';
  const httpMethod = 'POST';

  // case 1
  it('email does not exist', async () => {
    const userData = {
      email: 'testing@hackru.org',
      password: 'test',
    };

    const mockEvent = createEvent(userData, path, httpMethod);
    const mockCallback = jest.fn();
    const result = await main(mockEvent, mockContext, mockCallback);

    expect(result.statusCode).toBe(403);
    expect(JSON.parse(result.body).message).toBe('Invalid email');
  });

  // case 2
  it('invalid password', async () => {
    const userData = {
      email: 'test@test.org',
      password: 'hackru',
    };

    const mockEvent = createEvent(userData, path, httpMethod);
    const mockCallback = jest.fn();

    (bcrypt.compare as jest.Mock).mockReturnValue(false);
    const result = await main(mockEvent, mockContext, mockCallback);

    expect(result.statusCode).toBe(403);
    expect(JSON.parse(result.body).message).toBe('Wrong password');
  });

  // case 3
  it('correct email and password', async () => {
    const userData = {
      email: 'test@test.org',
      password: 'test',
    };

    const mockEvent = createEvent(userData, path, httpMethod);
    const mockCallback = jest.fn();

    (bcrypt.compare as jest.Mock).mockReturnValue(true);
    (jwt.sign as jest.Mock).mockReturnValue('mockToken');
    const result = await main(mockEvent, mockContext, mockCallback);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).message).toBe('Authentication Successful');
    expect(JSON.parse(result.body).token).toBeDefined();
    expect(JSON.parse(result.body).token).toBe('mockToken');
  });
});
