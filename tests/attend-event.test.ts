import { main } from '../src/functions/attend-event/handler';
import { createEvent, mockContext } from './helper';

import { validateToken } from '../src/util';

jest.mock('jsonwebtoken');
jest.mock('bcryptjs');
jest.mock('../src/functions/attend-event/handler');

jest.mock('../src/util', () => ({
  MongoDB: {
    getInstance: jest.fn().mockReturnValue({
      connect: jest.fn(),
      disconnect: jest.fn(),
      getCollection: jest.fn().mockReturnValue({
        findOne: jest.fn().mockReturnValueOnce(null).mockReturnValue({ email: 'test@test.org', password: 'test' }),
      }),
    }),
  },
  validateToken: jest.fn(),
}));


describe('Attend Event tests', () => {
  const path = '/attend-event';
  const httpMethod = 'POST';

  // case 1: auth token is not valid
  it('auth token is not valid', async () => {
    const userData = {
      email: 'test@hackru.org',
      password: 'test',
    };

    const mockEvent = createEvent(userData, path, httpMethod);
    const mockCallback = jest.fn();

    (validateToken as jest.Mock).mockReturnValue(false);

    const result = await main(mockEvent, mockContext, mockCallback);

    expect(result.statusCode).toBe(401);
    expect(JSON.parse(result.body).message).toBe('Unauthorized.');
  });

});
