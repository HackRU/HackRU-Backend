import { main } from '../src/functions/discord/handler';
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

jest.mock('../src/libs/discord', () => ({
  getDiscordTokens: jest.fn().mockReturnValue({
    accessToken: 'mockAccessToken',
    refreshToken: 'mockRefreshToken',
    expiresAt: Date.now(),
  }),
  getDiscordUser: jest.fn().mockReturnValue({
    userId: 'mockDiscordUserId',
    username: 'mockDiscordUsername',
  }),
  updateDiscordMetadata: jest.fn(),
}));

describe('Discord verification tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const userData = {
    email: 'test@hackru.org',
    auth_token: 'mockToken',
    code: 'mockCode',
    redirect_uri: 'mockRedirectURI',
  };
  const path = '/discord';
  const httpMethod = 'POST';

  const findOneMock = util.MongoDB.getInstance('uri').getCollection('users').findOne as jest.Mock;
  const mockCallback = jest.fn();

  it('auth token is not valid', async () => {
    const mockEvent = createEvent(userData, path, httpMethod);

    const result = await main(mockEvent, mockContext, mockCallback);

    expect(result.statusCode).toBe(401);
    expect(JSON.parse(result.body).message).toBe('Unauthorized');
  });

  it('user does not exist', async () => {
    findOneMock.mockReturnValueOnce(null);
    const mockEvent = createEvent(userData, path, httpMethod);

    const result = await main(mockEvent, mockContext, mockCallback);

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body).message).toBe('User not found');
  });

  it('success', async () => {
    findOneMock.mockReturnValueOnce({
      email: 'test@hackru.org',
    });
    const mockEvent = createEvent(userData, path, httpMethod);
    const result = await main(mockEvent, mockContext, mockCallback);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).message).toBe('Discord user verified');
  });
});
