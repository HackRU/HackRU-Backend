import { main } from '../src/functions/add-points/handler';
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
        insertOne: jest.fn(),
      }),
    }),
  },
  validateToken: jest.fn().mockReturnValueOnce(false).mockReturnValue(true),
  ensureRoles: jest.fn((roleDict, validRoles) => {
    return validRoles.some((role) => roleDict[role]);
  }),
}));

describe('add-points tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const userData = {
    auth_email: 'authUser@test.org',
    auth_token: 'mockToken',
    hacker_email: 'hackerUser@test.org',
    amount: 5,
  };
  const path = '/add-points';
  const httpMethod = 'POST';

  const findOneMock = util.MongoDB.getInstance('uri').getCollection('users').findOne as jest.Mock;
  const mockCallback = jest.fn();

  // case 1
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
    expect(JSON.parse(result.body).message).toBe('Auth user not found.');
  });

  // case 3
  it('Auth user does not have director/organizer role', async () => {
    findOneMock.mockReturnValueOnce({
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

  // case 5
  it('success', async () => {
    findOneMock
      .mockReturnValueOnce({
        role: {
          hacker: false,
          volunteer: true,
          judge: false,
          sponsor: false,
          mentor: false,
          organizer: true,
          director: false,
        },
      })
      .mockReturnValueOnce({
        email: 'hackerUser@test.org',
        balance: 3,
      });

    const mockEvent = createEvent(userData, path, httpMethod);
    const result = await main(mockEvent, mockContext, mockCallback);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).message).toBe('Successfully added points');
    expect(JSON.parse(result.body).balance).toBe(8);
  });
});
