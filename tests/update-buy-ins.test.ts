import { main } from '../src/functions/update-buy-ins/handler';
import { createEvent, mockContext } from './helper';

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
    auth_token: 'mockToken'
  };
  
  const path = '/update-buy-ins';
  const httpMethod = 'POST';

  const mockCallback = jest.fn();

  // case 1: auth token is not valid
  it('auth token is not valid', async () => {
    const mockEvent = createEvent(userData, path, httpMethod);

    const result = await main(mockEvent, mockContext, mockCallback);

    expect(result.statusCode).toBe(401);
    expect(JSON.parse(result.body).message).toBe('Unauthorized');
  });

});