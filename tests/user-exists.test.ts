import { main } from '../src/functions/user-exists/handler';

import { createEvent, mockContext } from './helper';
import * as util from '../src/util';

jest.mock('../src/util', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention
  MongoDB: {
    getInstance: jest.fn().mockReturnValue({
      connect: jest.fn(),
      disconnect: jest.fn(),
      getCollection: jest.fn().mockReturnValue({
        findOne: jest.fn(),
        find: jest.fn().mockReturnValue({
          toArray: jest.fn(),
        }),
      }),
    }),
  },
  validateToken: jest.fn().mockReturnValueOnce(false).mockReturnValue(true),
}));

describe('/user-exists endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  const path = '/user-exists';
  const httpMethod = 'POST';

  const findOneMock = util.MongoDB.getInstance('uri').getCollection('users').findOne as jest.Mock;
  const mockCallback = jest.fn();

  it('invalid token', async () => {
    const userData = {
      auth_email: 'hacker@hackru.org',
      auth_token: 'mockToken',
      email: 'hacker@hackru.org',
    };
    const mockEvent = createEvent(userData, path, httpMethod);

    const res = await main(mockEvent, mockContext, mockCallback);
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).message).toBe('Unauthorized');
  });

  it('auth user not found', async () => {
    findOneMock.mockReturnValueOnce(null);
    const userData = {
      auth_email: 'non-existent-user@hackru.org',
      auth_token: 'mockToken',
      email: 'hacker@hackru.org',
    };
    const mockEvent = createEvent(userData, path, httpMethod);

    const res = await main(mockEvent, mockContext, mockCallback);
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).message).toBe('Auth user not found.');
  });

  it('look-up user not found', async () => {
    findOneMock
      .mockReturnValueOnce({
        email: 'hackerCheck@hackru.org',
      })
      .mockReturnValueOnce(null);
    const userData = {
      auth_email: 'hackerCheck@hackru.org',
      auth_token: 'mockToken',
      email: 'non-existent-user@hackru.org',
    };
    const mockEvent = createEvent(userData, path, httpMethod);

    const res = await main(mockEvent, mockContext, mockCallback);

    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).message).toBe('Look-up user was not found');
  });

  it('success case', async () => {
    //can check even if you don't have the admin role
    findOneMock
      .mockReturnValueOnce({
        email: 'hackerCheck@hackru.org',
      })
      .mockReturnValueOnce({});
    const userData = {
      auth_email: 'hackerCheck@hackru.org',
      auth_token: 'mockToken',
      email: 'hacker@hackru.org',
    };
    const mockEvent = createEvent(userData, path, httpMethod);

    const res = await main(mockEvent, mockContext, mockCallback);

    expect(res.statusCode).toBe(200);
    expect(res.body).toBeDefined();
  });

  it('success case for all lookup', async () => {
    findOneMock
      .mockReturnValueOnce({
        email: 'hackerCheck@hackru.org',
      })
      .mockReturnValueOnce({ email: 'targetHacker@hackru.org' });
    const userData = {
      auth_email: 'hackerCheck@hackru.org',
      auth_token: 'mockToken',
      email: 'anyemail@hackru.org',
    };
    const mockEvent = createEvent(userData, path, httpMethod);
    const res = await main(mockEvent, mockContext, mockCallback);
    console.log(res.body);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual('User exists');
  });
});
