import { beforeEach, describe, expect, it } from '@jest/globals';
import { main } from '../src/functions/verify-email/handler';
import { createEvent, mockContext } from './helper';
import * as util from '../src/util';

jest.mock('jsonwebtoken');
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
        findOne: jest.fn(),
        updateOne: jest.fn(),
      }),
    }),
  },
  validateToken: jest.fn(),
  verifyEmailCode: jest.fn(),
}));

describe('Verify email tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const path = '/verify-email';
  const httpMethod = 'POST';
  const mockCallback = jest.fn();

  it('Invalid email verification code', async () => {
    (util.verifyEmailCode as jest.Mock).mockReturnValue(false);

    const userData = { code: 'invalidCode' };
    const mockEvent = createEvent(userData, path, httpMethod);

    const res = await main(mockEvent, mockContext, mockCallback);

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).message).toBe('Invalid email verification code. It may be expired.');
  });

  it('User not found with verification code', async () => {
    (util.verifyEmailCode as jest.Mock).mockReturnValue('verifiedEmail@test.com');
    const findOneMock = util.MongoDB.getInstance('uri').getCollection('users').findOne as jest.Mock;
    findOneMock.mockReturnValueOnce(null);

    const userData = { code: 'validCode' };
    const mockEvent = createEvent(userData, path, httpMethod);

    const res = await main(mockEvent, mockContext, mockCallback);

    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).message).toBe('User not found');
  });

  it('Email verified successfully', async () => {
    (util.verifyEmailCode as jest.Mock).mockReturnValue('verifiedEmail@test.com');
    const findOneMock = util.MongoDB.getInstance('uri').getCollection('users').findOne as jest.Mock;
    findOneMock.mockReturnValueOnce({ email: 'verifiedEmail@test.com' });

    const updateOneMock = util.MongoDB.getInstance('uri').getCollection('users').updateOne as jest.Mock;
    updateOneMock.mockReturnValue({});

    const userData = { code: 'validCode' };
    const mockEvent = createEvent(userData, path, httpMethod);

    const res = await main(mockEvent, mockContext, mockCallback);

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).message).toBe('HackRU account (verifiedEmail@test.com) email verified successfully.');
  });

  it('Unauthorized email verification request', async () => {
    (util.validateToken as jest.Mock).mockReturnValue(false);

    const userData = { email: 'test@test.com', auth_token: 'invalidToken' };
    const mockEvent = createEvent(userData, path, httpMethod);

    const res = await main(mockEvent, mockContext, mockCallback);

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).message).toBe('Unauthorized');
  });

  it('User not found with email', async () => {
    (util.validateToken as jest.Mock).mockReturnValue(true);
    const findOneMock = util.MongoDB.getInstance('uri').getCollection('users').findOne as jest.Mock;
    findOneMock.mockReturnValueOnce(null);

    const userData = { email: 'test@test.com', auth_token: 'validToken' };
    const mockEvent = createEvent(userData, path, httpMethod);

    const res = await main(mockEvent, mockContext, mockCallback);

    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).message).toBe('User not found');
  });

  it('User email already verified', async () => {
    (util.validateToken as jest.Mock).mockReturnValue(true);
    const findOneMock = util.MongoDB.getInstance('uri').getCollection('users').findOne as jest.Mock;
    findOneMock.mockReturnValueOnce({ email: 'test@test.com', email_verified: true });

    const userData = { email: 'test@test.com', auth_token: 'validToken' };
    const mockEvent = createEvent(userData, path, httpMethod);

    const res = await main(mockEvent, mockContext, mockCallback);

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).message).toBe('User email already verified');
  });

  it('User email verification sent', async () => {
    (util.validateToken as jest.Mock).mockReturnValue(true);
    const findOneMock = util.MongoDB.getInstance('uri').getCollection('users').findOne as jest.Mock;
    findOneMock.mockReturnValueOnce({
      email: 'test@test.com',
      first_name: 'Test',
      last_name: 'User',
      email_verified: false,
    });

    const userData = { email: 'test@test.com', auth_token: 'validToken' };
    const mockEvent = createEvent(userData, path, httpMethod);

    const res = await main(mockEvent, mockContext, mockCallback);

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).message).toBe('User email verification sent');
  });
});
