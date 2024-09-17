import { main } from '../src/functions/points/handler';
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
      }),
    }),
  },
  validateToken: jest.fn(),
}));

describe('Points endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
  });

  const path = '/points';
  const httpMethod = 'POST';

  it('should return 400 for invalid email format', async () => {
    const userData = {
      email: 'invalidEmail',
      auth_token: 'mockToken',
    };
    const mockEvent = createEvent(userData, path, httpMethod);
    const result = await main(mockEvent, mockContext, jest.fn());

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).message).toBe('Invalid email format');
  });

  it('should return 401 for invalid auth token', async () => {
    const userData = {
      email: 'testab@test.org',
      auth_token: 'invalidToken',
    };
    const mockEvent = createEvent(userData, path, httpMethod);
    (util.validateToken as jest.Mock).mockReturnValue(false);

    const result = await main(mockEvent, mockContext, jest.fn());

    expect(result.statusCode).toBe(401);
    expect(JSON.parse(result.body).message).toBe('Unauthorized');
  });

  it('should return 404 if user is not found', async () => {
    const userData = {
      email: 'nonexistent@email.com',
      auth_token: 'validToken',
    };
    const mockEvent = createEvent(userData, path, httpMethod);
    (util.validateToken as jest.Mock).mockReturnValue(true);
    const findOneMock = util.MongoDB.getInstance('uri').getCollection('users').findOne as jest.Mock;
    findOneMock.mockResolvedValue(null);

    const result = await main(mockEvent, mockContext, jest.fn());

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body).message).toBe('User not found.');
  });

  // TODO: Add more tests here for the TODO sections once they are implemented

  it('should return 500 for internal server error', async () => {
    const userData = {
      email: 'valid@email.com',
      auth_token: 'validToken',
    };
    const mockEvent = createEvent(userData, path, httpMethod);
    (util.validateToken as jest.Mock).mockReturnValue(true);
    const findOneMock = util.MongoDB.getInstance('uri').getCollection('users').findOne as jest.Mock;
    findOneMock.mockRejectedValue(new Error('Database error'));

    const result = await main(mockEvent, mockContext, jest.fn());

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body).message).toBe('Internal server error.');
  });
});
