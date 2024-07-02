import { main } from '../src/functions/waiver/handler';
import { createEvent, mockContext } from './helper';
import * as util from '../src/util';

jest.mock('../src/util', () => ({
  validateToken: jest.fn().mockReturnValueOnce(false).mockReturnValue(true),
  checkIfFileExists: jest.fn(),
  generatePresignedUrl: jest.fn().mockReturnValue('presigned-url'),
}));

describe('/waiver tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const userData = {
    email: 'hacker@hackru.org',
    auth_token: 'mockAuthToken',
  }
  const mockCallback = jest.fn();

  const mockCheckIfFileExist = util.checkIfFileExists as jest.Mock;

  it('invalid auth token', async () => {
    const mockEvent = createEvent(userData, '/waiver', 'POST');

    const res = await main(mockEvent, mockContext, mockCallback);
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).message).toBe('Unauthorized');
  })

  it('user has already uploaded waiver', async () => {
    const mockEvent = createEvent(userData, '/waiver', 'POST');
    mockCheckIfFileExist.mockReturnValueOnce(true);

    const res = await main(mockEvent, mockContext, mockCallback);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).message).toBe('You already submitted a waiver');
  })

  it('success case, return a presigned url', async () => {
    const mockEvent = createEvent(userData, '/waiver', 'POST');
    mockCheckIfFileExist.mockReturnValueOnce(false);

    const res = await main(mockEvent, mockContext, mockCallback);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).url).toBe('presigned-url');
  })
});