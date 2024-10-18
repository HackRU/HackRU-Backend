import { main } from '../src/functions/get-buy-ins/handler';
import { createEvent, mockContext } from './helper';

jest.mock('../src/util', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention
  MongoDB: {
    getInstance: jest.fn().mockReturnValue({
      connect: jest.fn(),
      disconnect: jest.fn(),
      getCollection: jest.fn().mockReturnValue({
        findOne: jest.fn(),
        aggregate: jest.fn().mockReturnValue({
          // eslint-disable-next-line @typescript-eslint/naming-convention
          toArray: jest.fn().mockReturnValue([{ _id: 'prizeA', sum: 30 }]),
        }),
      }),
    }),
  },
  validateToken: jest.fn().mockReturnValueOnce(false).mockReturnValue(true),
}));

describe('get-buy-ins tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const path = '/get-buy-ins';
  const httpMethod = 'POST';

  const mockCallback = jest.fn();

  it('auth token is not valid', async () => {
    const userData = {
      email: 'test@test.org',
      auth_token: 'invalidToken',
    };

    const mockEvent = createEvent(userData, path, httpMethod);

    const result = await main(mockEvent, mockContext, mockCallback);

    expect(result.statusCode).toBe(401);
    expect(JSON.parse(result.body).message).toBe('Unauthorized');
  });

  it('success', async () => {
    const userData = {
      email: 'test@test.org',
      auth_token: 'validToken',
    };

    const mockEvent = createEvent(userData, path, httpMethod);
    const result = await main(mockEvent, mockContext, jest.fn());

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.buyIns.prizeA).toBe(30);
  });
});
