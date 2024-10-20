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

  it('should return 404 if points not found for user', async () => {
    const userData = {
      email: 'test@example.com',
      auth_token: 'validToken',
    };
    const mockEvent = createEvent(userData, path, httpMethod);
    (util.validateToken as jest.Mock).mockReturnValue(true);
    const findOneMock = util.MongoDB.getInstance('uri').getCollection('').findOne as jest.Mock;
    findOneMock.mockResolvedValueOnce({ email: 'test@example.com' }); // user found
    findOneMock.mockResolvedValueOnce(null); // points not found

    const result = await main(mockEvent, mockContext, jest.fn());

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body).message).toBe('Points not found for this user.');
  });

  it('should return 200 with balance, total_points, and buy_ins for valid user', async () => {
    const userData = {
      email: 'valid@email.com',
      auth_token: 'validToken',
    };
    const mockEvent = createEvent(userData, path, httpMethod);
    (util.validateToken as jest.Mock).mockReturnValue(true);
    const findOneMock = util.MongoDB.getInstance('uri').getCollection('users').findOne as jest.Mock;
    findOneMock.mockResolvedValueOnce({ email: 'valid@email.com' }); // User exists
    findOneMock.mockResolvedValueOnce({
      email: 'valid@email.com',
      balance: 100,
      total_points: 150,
      buy_ins: [
        { prize_id: 'prizeA', buy_in: 50 },
        { prize_id: 'prizeB', buy_in: 30 },
      ],
    }); // Points and buy_ins found

    const result = await main(mockEvent, mockContext, jest.fn());

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.balance).toBe(100);
    expect(body.total_points).toBe(150);
    expect(body.buy_ins).toEqual([
      { prize_id: 'prizeA', buy_in: 50 },
      { prize_id: 'prizeB', buy_in: 30 },
    ]);
  });

  it('should return 200 with balance, total_points, and empty buy_ins array if not present', async () => {
    const userData = {
      email: 'valid@email.com',
      auth_token: 'validToken',
    };
    const mockEvent = createEvent(userData, path, httpMethod);
    (util.validateToken as jest.Mock).mockReturnValue(true);
    const findOneMock = util.MongoDB.getInstance('uri').getCollection('users').findOne as jest.Mock;
    findOneMock.mockResolvedValueOnce({ email: 'valid@email.com' }); // User exists
    findOneMock.mockResolvedValueOnce({
      email: 'valid@email.com',
      balance: 100,
      total_points: 150,
    }); // Points found, but no buy_ins

    const result = await main(mockEvent, mockContext, jest.fn());

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.balance).toBe(100);
    expect(body.total_points).toBe(150);
    expect(body.buy_ins).toEqual([]);
  });

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
