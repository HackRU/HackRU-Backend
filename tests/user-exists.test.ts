import { main } from '../src/functions/user-exists/handler';
import { createEvent, mockContext } from './helper';
import * as util from '../src/util';

jest.mock('../src/util', () => ({
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
  userExistsLogic: jest.fn(),
}));

describe('/user-exists endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const path = '/user-exists';
  const httpMethod = 'POST';

  const userExistsLogicMock = util.userExistsLogic as jest.Mock;

  it('should reject invalid token', async () => {
    userExistsLogicMock.mockResolvedValueOnce({
      statusCode: 401,
      body: JSON.stringify({ message: 'Unauthorized' }),
    });

    const userData = {
      auth_email: 'hacker@hackru.org',
      auth_token: 'invalidToken',
      email: 'hacker@hackru.org',
    };
    const mockEvent = createEvent(userData, path, httpMethod);

    const res = await main(mockEvent, mockContext, null);

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).message).toBe('Unauthorized');
  });

  it('should reject when auth user is not found', async () => {
    userExistsLogicMock.mockResolvedValueOnce({
      statusCode: 404,
      body: JSON.stringify({ message: 'Auth user not found.' }),
    });

    const userData = {
      auth_email: 'non-existent-user@hackru.org',
      auth_token: 'validToken',
      email: 'hacker@hackru.org',
    };
    const mockEvent = createEvent(userData, path, httpMethod);

    const res = await main(mockEvent, mockContext, null);

    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).message).toBe('Auth user not found.');
  });

  it('should reject when lookup user is not found', async () => {
    userExistsLogicMock.mockResolvedValueOnce({
      statusCode: 404,
      body: JSON.stringify({ message: 'Look-up user was not found' }),
    });

    const userData = {
      auth_email: 'hackerCheck@hackru.org',
      auth_token: 'validToken',
      email: 'non-existent-user@hackru.org',
    };
    const mockEvent = createEvent(userData, path, httpMethod);

    const res = await main(mockEvent, mockContext, null);

    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).message).toBe('Look-up user was not found');
  });

  it('should return success when lookup user exists', async () => {
    userExistsLogicMock.mockResolvedValueOnce({
      statusCode: 200,
      body: JSON.stringify('User exists'),
    });

    const userData = {
      auth_email: 'hackerCheck@hackru.org',
      auth_token: 'validToken',
      email: 'hacker@hackru.org',
    };
    const mockEvent = createEvent(userData, path, httpMethod);

    const res = await main(mockEvent, mockContext, null);

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toBe('User exists');
  });

  it('should return success for all lookup cases', async () => {
    userExistsLogicMock.mockResolvedValueOnce({
      statusCode: 200,
      body: JSON.stringify('User exists'),
    });

    const userData = {
      auth_email: 'hackerCheck@hackru.org',
      auth_token: 'validToken',
      email: 'anyemail@hackru.org',
    };
    const mockEvent = createEvent(userData, path, httpMethod);

    const res = await main(mockEvent, mockContext, null);

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toBe('User exists');
  });
});
