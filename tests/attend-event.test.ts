import { main } from '../src/functions/attend-event/handler';
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
        updateOne: jest.fn(),
      }),
    }),
  },
  validateToken: jest.fn().mockReturnValueOnce(false).mockReturnValue(true),
  ensureRoles: jest.fn((roleDict, validRoles) => {
    return validRoles.some((role) => roleDict[role]);
  }),
}));

describe('Attend-Event tests', () => {
  beforeEach(() => {
    jest.clearAllMocks(); // Clear mocks before each test to avoid interference
  });

  const userData = {
    auth_email: 'authUser@test.org',
    auth_token: 'mockToken',
    qr: 'test@test.org',
    event: 'lunch',
    limit: 1,
  };
  const path = '/attend-event';
  const httpMethod = 'POST';

  // this will make it more concise and easier to understand (mocking)
  const findOneMock = util.MongoDB.getInstance('uri').getCollection('users').findOne as jest.Mock;
  const mockCallback = jest.fn();

  // case 1: auth token is not valid
  it('auth token is not valid', async () => {
    const mockEvent = createEvent(userData, path, httpMethod);

    const result = await main(mockEvent, mockContext, mockCallback);

    expect(result.statusCode).toBe(401);
    expect(JSON.parse(result.body).message).toBe('Unauthorized.');
  });

  // case 2
  it('user does not exist', async () => {
    findOneMock.mockReturnValueOnce(null);
    const mockEvent = createEvent(userData, path, httpMethod);

    const result = await main(mockEvent, mockContext, mockCallback);

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body).message).toBe('User not found.');
  });

  // case 3
  it('Auth user does not have director/organizer role', async () => {
    findOneMock.mockReturnValueOnce({}).mockReturnValueOnce({
      role: {
        hacker: false,
        volunteer: true,
        judge: false,
        sponsor: false,
        mentor: false,
        organizer: false,
        director: false,
      },
    });
    const mockEvent = createEvent(userData, path, httpMethod);

    const result = await main(mockEvent, mockContext, mockCallback);

    expect(result.statusCode).toBe(401);
    expect(JSON.parse(result.body).message).toBe('Only directors/organizers can call this endpoint.');
  });

  // case 4
  it('user tries to check into an event the second time but it can only be attended once', async () => {
    findOneMock
      .mockReturnValueOnce({
        day_of: {
          event: {
            lunch: {
              attend: 1,
            },
          },
        },
        registration_status: 'checked_in',
      })
      .mockReturnValueOnce({
        role: {
          hacker: false,
          volunteer: false,
          judge: false,
          sponsor: false,
          mentor: false,
          organizer: true,
          director: false,
        },
      });
    const mockEvent = createEvent(userData, path, httpMethod);

    const result = await main(mockEvent, mockContext, mockCallback);

    expect(result.statusCode).toBe(409);
    expect(JSON.parse(result.body).message).toBe('User already checked into event.');
  });

  // case 5
  it('success check-in to an event', async () => {
    findOneMock
      .mockReturnValueOnce({
        day_of: {},
        registration_status: 'checked_in',
      })
      .mockReturnValueOnce({
        role: {
          hacker: false,
          volunteer: true,
          judge: false,
          sponsor: false,
          mentor: false,
          organizer: false,
          director: true,
        },
      });
    const mockEvent = createEvent(userData, path, httpMethod);
    const result = await main(mockEvent, mockContext, mockCallback);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).message).toBe('user successfully checked into event');
  });

  it('user tries to attend event when they are not checked_in', async () => {
    findOneMock
      .mockReturnValueOnce({
        day_of: {},
        registration_status: 'registered',
      })
      .mockReturnValueOnce({
        role: {
          hacker: false,
          volunteer: true,
          judge: false,
          sponsor: false,
          mentor: false,
          organizer: false,
          director: true,
        },
      });
    const mockEvent = createEvent(userData, path, httpMethod);
    const result = await main(mockEvent, mockContext, mockCallback);

    expect(result.statusCode).toBe(409);
    expect(JSON.parse(result.body).message).toBe('User has not checked in. Current status is registered');
  });
});
