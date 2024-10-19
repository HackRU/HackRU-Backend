import { main } from '../src/functions/update-buy-ins/handler';
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
}));

describe('Update-Buy-Ins tests', () => {
  beforeEach(() => {
    jest.clearAllMocks(); // Clear mocks before each test to avoid interference
  });

  const userData = {
    email: 'mockEmail@mock.org',
    buy_ins: [
      { prize_id: 'prize1', buy_in: 10 },
      { prize_id: 'prize2', buy_in: 20 },
    ],
  };

  const path = '/update-buy-ins';
  const httpMethod = 'POST';

  const findOneMock = util.MongoDB.getInstance('uri').getCollection('users').findOne as jest.Mock;
  const mockCallback = jest.fn();

  // case 1
  it('auth token is not valid', async () => {
    const mockEvent = createEvent(userData, path, httpMethod);

    const result = await main(mockEvent, mockContext, mockCallback);

    expect(result.statusCode).toBe(401);
    expect(JSON.parse(result.body).message).toBe('Unauthorized');
  });

  // case 2
  it('user not found', async () => {
    findOneMock.mockReturnValueOnce(null);
    const mockEvent = createEvent(userData, path, httpMethod);

    const result = await main(mockEvent, mockContext, mockCallback);

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body).message).toBe('User point balance information not found');
  });

  // case 3
  it('prize IDs do not match', async () => {
    findOneMock.mockReturnValueOnce({
      email: userData.email,
      total_points: 100,
      balance: 2,
      buy_ins: [
        { prize_id: 'prize2', buy_in: 10 },
        { prize_id: 'prize2', buy_in: 20 },
      ],
    });

    const mockEvent = createEvent(userData, path, httpMethod);

    const result = await main(mockEvent, mockContext, mockCallback);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).message).toBe('Request body prizes do not match');
  });

  // case 4
  it('points distributed exceed user point total', async () => {
    findOneMock.mockReturnValueOnce({
      email: userData.email,
      total_points: 15,
      balance: 2,
      buy_ins: [
        { prize_id: 'prize1', buy_in: 5 },
        { prize_id: 'prize2', buy_in: 11 },
      ],
    });

    const mockEvent = createEvent(userData, path, httpMethod);

    const result = await main(mockEvent, mockContext, mockCallback);

    expect(result.statusCode).toBe(403);
    expect(JSON.parse(result.body).message).toBe('Points distributed exceed user point total.');
  });

  // case 5
  it('successfully update user point balance', async () => {
    findOneMock.mockReturnValueOnce({
      email: userData.email,
      total_points: 30,
      balance: 2,
      buy_ins: [
        { prize_id: 'prize1', buy_in: 10 },
        { prize_id: 'prize2', buy_in: 20 },
      ],
    });

    const mockEvent = createEvent(userData, path, httpMethod);

    const result = await main(mockEvent, mockContext, mockCallback);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).message).toBe('Updated user point balance successfully');
  });
});
