import { main } from '../src/functions/resume/handler';
import { createEvent, mockContext } from './helper';

jest.mock('../src/util', () => ({
  validateToken: jest.fn().mockReturnValueOnce(false).mockReturnValue(true),
  generatePresignedUrl: jest.fn().mockReturnValue('presigned-url'),
  checkIfFileExists: jest.fn().mockReturnValueOnce(true).mockReturnValue(false),
}));

describe('/resume tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const userData = {
    email: 'hacker@hackru.org',
    auth_token: 'mockAuthToken',
  };
  const path = '/resume';
  const httpMethod = 'POST';
  const mockCallback = jest.fn();

  it('invalid auth token', async () => {
    const mockEvent = createEvent(userData, path, httpMethod);

    const res = await main(mockEvent, mockContext, mockCallback);
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).message).toBe('Unauthorized');
  });

  it('resume already submitted once before', async () => {
    const mockEvent = createEvent(userData, path, httpMethod);

    const res = await main(mockEvent, mockContext, mockCallback);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).hasUploaded).toBe(true);
    expect(JSON.parse(res.body).url).toBe('presigned-url');
  });

  it('success case, return a presigned url', async () => {
    const mockEvent = createEvent(userData, path, httpMethod);

    const res = await main(mockEvent, mockContext, mockCallback);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).hasUploaded).toBe(false);
    expect(JSON.parse(res.body).url).toBe('presigned-url');
  });
});
