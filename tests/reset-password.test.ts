import { main } from '../src/functions/reset-password/handler';
import { createEvent, mockContext } from './helper';
import * as bcrypt from 'bcryptjs';
import * as util from '../src/util';

jest.mock('bcryptjs');

jest.mock('../src/util', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention
  MongoDB: {
    getInstance: jest.fn().mockReturnValue({
      connect: jest.fn(),
      disconnect: jest.fn(),
      getCollection: jest.fn().mockReturnValue({
        findOne: jest.fn(),
        updateOne: jest.fn(),
        deleteOne: jest.fn(),
      }),
    }),
  },
}));

describe('Reset password tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const path = '/reset-password';
  const httpMethod = 'POST';

  const findOneMock = util.MongoDB.getInstance('uri').getCollection('users').findOne as jest.Mock;

  // case 1
  test('Invalid email', async () => {
    findOneMock.mockReturnValueOnce(null);

    const userData = {
      email: 'testing@hackru.org',
      reset_token: 'resetToken',
      new_password: 'test',
    };

    const mockEvent = createEvent(userData, path, httpMethod);
    const mockCallback = jest.fn();
    const result = await main(mockEvent, mockContext, mockCallback);

    expect(result.statusCode).toBe(403);
    expect(JSON.parse(result.body).message).toBe('Invalid email');
  });

  // case 2
  test('Invalid reset token', async () => {
    findOneMock.mockReturnValueOnce({
      email: 'testing@hackru.org',
      token: 'hashedToken',
      expiration: Date.now() + 15 * 60 * 1000,
    });
    (bcrypt.compare as jest.Mock).mockReturnValue(false);

    const userData = {
      email: 'testing@hackru.org',
      reset_token: 'resetToken',
      new_password: 'test',
    };

    const mockEvent = createEvent(userData, path, httpMethod);
    const mockCallback = jest.fn();

    const result = await main(mockEvent, mockContext, mockCallback);
    expect(result.statusCode).toBe(401);
    expect(JSON.parse(result.body).message).toBe('Reset token is invalid');
  });

  // case 3
  test('Reset token has expired', async () => {
    findOneMock.mockReturnValueOnce({
      email: 'testing@hackru.org',
      token: 'hashedToken',
      expiration: Date.now() - 10 * 60 * 1000,
    });
    // mock expiration date to be in the past so that the token will have already expired
    (bcrypt.compare as jest.Mock).mockReturnValue(true);

    const userData = {
      email: 'testing@hackru.org',
      reset_token: 'resetToken',
      new_password: 'test',
    };

    const mockEvent = createEvent(userData, path, httpMethod);
    const mockCallback = jest.fn();

    const result = await main(mockEvent, mockContext, mockCallback);
    expect(result.statusCode).toBe(401);
    expect(JSON.parse(result.body).message).toBe('Reset token has expired');
  });

  // case 4
  test('success password update', async () => {
    findOneMock.mockReturnValueOnce({
      email: 'testing@hackru.org',
      token: 'hashedToken',
      expiration: Date.now() + 15 * 60 * 1000,
    });
    const updateOneMock = util.MongoDB.getInstance('uri').getCollection('users').updateOne as jest.Mock;
    updateOneMock.mockReturnValue({});
    const deleteOneMock = util.MongoDB.getInstance('uri').getCollection('users').deleteOne as jest.Mock;
    deleteOneMock.mockReturnValue({});
    (bcrypt.compare as jest.Mock).mockReturnValue(true);

    const userData = {
      email: 'testing@hackru.org',
      reset_token: 'resetToken',
      new_password: 'test',
    };

    const mockEvent = createEvent(userData, path, httpMethod);
    const mockCallback = jest.fn();

    const result = await main(mockEvent, mockContext, mockCallback);
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).message).toBe('Password reset successful');
  });
});
