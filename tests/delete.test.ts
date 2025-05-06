jest.mock('../src/util', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention
  MongoDB: {
    getInstance: jest.fn().mockReturnValue({
      connect: jest.fn(),
      disconnect: jest.fn(),
      getCollection: jest.fn().mockReturnValue({
        findOne: jest.fn(),
        deleteOne: jest.fn(),
      }),
    }),
  },
  validateToken: jest.fn().mockReturnValueOnce(false).mockReturnValue(true),
  ensureRoles: jest.fn((roleDict, validRoles) => {
    return validRoles.some((role) => roleDict[role]);
  }),
}));

import { main } from '../src/functions/delete/handler';
import { createEvent, mockContext } from './helper';
import * as util from '../src/util';

// Ensure util mocks are applied before any tests

describe('Delete Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const userData = {
    auth_email: 'director@test.org',
    auth_token: 'mockToken',
    user_email: 'target@test.org',
  };
  const path = '/delete';
  const httpMethod = 'POST';

  const findOneMock = util.MongoDB.getInstance('uri').getCollection('users').findOne as jest.Mock;
  const deleteOneMock = util.MongoDB.getInstance('uri').getCollection('users').deleteOne as jest.Mock;

  it('auth token is not valid', async () => {
    const mockEvent = createEvent(userData, path, httpMethod);

    const result = await main(mockEvent, mockContext, undefined);

    expect(result.statusCode).toBe(401);
    expect(JSON.parse(result.body).message).toBe('Unauthorized');
  });

  it('user does not exist', async () => {
    findOneMock.mockReturnValueOnce(null);
    const mockEvent = createEvent(userData, path, httpMethod);

    const result = await main(mockEvent, mockContext, undefined);

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body).message).toBe('User not found');
  });

  it('Auth user does not have director/organizer role', async () => {
    findOneMock
      .mockReturnValueOnce({})
      .mockReturnValueOnce({
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

    const result = await main(mockEvent, mockContext, undefined);

    expect(result.statusCode).toBe(401);
    expect(JSON.parse(result.body).message).toBe('Only directors/organizers can call this endpoint.');
  });

  it('returns 500 when deleteOne does not delete', async () => {
    findOneMock
      .mockReturnValueOnce({ email: userData.user_email })
      .mockReturnValueOnce({ role: { hacker: false, organizer: false, director: true } });
    deleteOneMock.mockReturnValueOnce({ deletedCount: 0 });
    const mockEvent = createEvent(userData, path, httpMethod);

    const result = await main(mockEvent, mockContext, undefined);

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body).message).toBe('Internal server error');
  });

  it('deletes user successfully', async () => {
    findOneMock
      .mockReturnValueOnce({ email: userData.user_email })
      .mockReturnValueOnce({ role: { hacker: false, volunteer: true, organizer: true, director: false } });
    deleteOneMock.mockReturnValueOnce({ deletedCount: 1 });
    const mockEvent = createEvent(userData, path, httpMethod);

    const result = await main(mockEvent, mockContext, undefined);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).message).toBe(`Deleted ${userData.user_email} successfully`);
  });
});
