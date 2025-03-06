import { main } from '../src/functions/read/handler';

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
  ensureRoles: jest.fn((roleDict, validRoles) => {
    return validRoles.some((role) => roleDict[role]);
  }),
}));

describe('/read endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  const path = '/read';
  const httpMethod = 'POST';

  const findOneMock = util.MongoDB.getInstance('uri').getCollection('users').findOne as jest.Mock;
  const mockCallback = jest.fn();
  const findMock = util.MongoDB.getInstance('uri').getCollection('users').find as jest.Mock;

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

  it('auth user does not have hacker/organizer/director role', async () => {
    findOneMock.mockReturnValueOnce({
      role: {
        hacker: false,
        judge: true,
        organizer: false,
        director: false,
      },
    });
    const userData = {
      auth_email: 'judge@hackru.org',
      auth_token: 'mockToken',
      email: 'hacker@hackru.org',
    };
    const mockEvent = createEvent(userData, path, httpMethod);

    const res = await main(mockEvent, mockContext, mockCallback);
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).message).toBe('Unauthorized. Auth user is not an organizer/director/hacker.');
  });

  it('hacker tries looking up others info other than their own', async () => {
    findOneMock.mockReturnValueOnce({
      email: 'hacker@hackru.org',
      role: {
        hacker: true,
        organizer: false,
        director: false,
      },
    });
    const userData = {
      auth_email: 'hacker@hackru.org',
      auth_token: 'mockToken',
      email: 'director@hackru.org',
    };
    const mockEvent = createEvent(userData, path, httpMethod);

    const res = await main(mockEvent, mockContext, mockCallback);

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).message).toBe('Hackers can only look up their own information.');
  });

  it('look-up user not found', async () => {
    findOneMock
      .mockReturnValueOnce({
        email: 'director@hackru.org',
        role: {
          hacker: true,
          organizer: false,
          director: true,
        },
      })
      .mockReturnValueOnce(null);
    const userData = {
      auth_email: 'director@hackru.org',
      auth_token: 'mockToken',
      email: 'non-existent-user@hackru.org',
    };
    const mockEvent = createEvent(userData, path, httpMethod);

    const res = await main(mockEvent, mockContext, mockCallback);

    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).message).toBe('Look-up user not found.');
  });

  it('success case', async () => {
    findOneMock
      .mockReturnValueOnce({
        email: 'director@hackru.org',
        role: {
          hacker: true,
          organizer: false,
          director: true,
        },
      })
      .mockReturnValueOnce({});
    const userData = {
      auth_email: 'director@hackru.org',
      auth_token: 'mockToken',
      email: 'hacker@hackru.org',
    };
    const mockEvent = createEvent(userData, path, httpMethod);

    const res = await main(mockEvent, mockContext, mockCallback);

    expect(res.statusCode).toBe(200);
    expect(res.body).toBeDefined();
  });

  it('success case for all lookup', async () => {
    // For the "all" branch, auth user must have director or organizer role.
    findOneMock.mockReturnValueOnce({
      email: 'director@hackru.org',
      role: {
        hacker: true,
        organizer: false,
        director: true,
      },
    });
    const allUsers = [
      { email: 'user1@hackru.org', name: 'User One' },
      { email: 'user2@hackru.org', name: 'User Two' },
    ];
    const toArrayMock = jest.fn().mockResolvedValue(allUsers);
    findMock.mockReturnValueOnce({ toArray: toArrayMock });
    const userData = {
      auth_email: 'director@hackru.org',
      auth_token: 'mockToken',
      email: 'anyemail@hackru.org', // email is not used in the lookup when all=true
      all: true,
    };
    const mockEvent = createEvent(userData, path, httpMethod);
    const res = await main(mockEvent, mockContext, mockCallback);

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual(allUsers);
  });

  it('internal server error', async () => {
    findOneMock.mockImplementationOnce(() => {
      throw new Error('Database error');
    });
    const userData = {
      auth_email: 'director@hackru.org',
      auth_token: 'mockToken',
      email: 'hacker@hackru.org',
    };
    const mockEvent = createEvent(userData, path, httpMethod);

    const res = await main(mockEvent, mockContext, mockCallback);

    expect(res.statusCode).toBe(500);
    expect(res.body).toBeDefined();
  });
});
