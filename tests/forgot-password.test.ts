import { beforeEach, describe, expect, it } from '@jest/globals';
import { main } from '../src/functions/forgot-password/handler';
import { createEvent, mockContext } from './helper';
import * as bcrypt from 'bcryptjs';

jest.mock('bcryptjs');
jest.mock('@aws-sdk/client-sesv2', () => {
  return {
    SESv2Client: jest.fn().mockReturnValue({
      send: jest.fn(),
    }),
    SendEmailCommand: jest.fn(),
  };
});
jest.mock('../src/util', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention
  MongoDB: {
    getInstance: jest.fn().mockReturnValue({
      connect: jest.fn(),
      disconnect: jest.fn(),
      getCollection: jest.fn().mockReturnValue({
        findOne: jest.fn().mockReturnValueOnce(null).mockReturnValue({ email: 'test@test.org' }),
        insertOne: jest.fn().mockReturnValue({ insertedId: 'someId' }),
      }),
    }),
  },
}));

describe('Forgot password tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  const path = '/forgot-password';
  const httpMethod = 'POST';
  const userData = { email: 'test@test.org' };
  const mockCallback = jest.fn();
  it('User requesting reset password is not found', async () => {
    const mockEvent = createEvent(userData, path, httpMethod);

    const res = await main(mockEvent, mockContext, mockCallback);

    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body)).toEqual({ message: 'User not found' });
  });

  it('Password reset successfully emailed', async () => {
    const mockEvent = createEvent(userData, path, httpMethod);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashedToken');

    const res = await main(mockEvent, mockContext, mockCallback);

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ message: 'Password reset info emailed' });
  });
});
