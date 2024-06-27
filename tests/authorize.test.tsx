// authorize.test.ts

import { main } from '../src/functions/authorize/handler';

import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';

interface Event {
  body: string;
  path: string;
  httpMethod: string;
  headers: Record<string, string>;
  multiValueHeaders: Record<string, string[]>; // Adjusted type for multiValueHeaders
  isBase64Encoded: boolean;
  pathParameters: null | Record<string, string>;
  queryStringParameters: null | Record<string, string>;
  multiValueQueryStringParameters: null | Record<string, string[]>;
  requestContext: null; // Adjust type as needed
  resource: string;
  stageVariables: null | Record<string, string>;
  rawBody: string; // Adjusted type for rawBody
}

function createEvent(userData: Record<string, string>, path: string, httpMethod: string): Event {
  const event: Event = {
    body: JSON.stringify(userData),
    path,
    httpMethod,
    headers: {
      'Content-Type': 'application/json',
    },
    multiValueHeaders: {},
    isBase64Encoded: false,
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    requestContext: null,
    resource: '',
    stageVariables: null,
    rawBody: JSON.stringify(userData),
  };

  return event;
}

jest.mock('jsonwebtoken');
jest.mock('bcryptjs');

jest.mock('../src/util', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention
  MongoDB: {
    getInstance: jest.fn().mockReturnValue({
      connect: jest.fn(),
      disconnect: jest.fn(),
      getClient: jest.fn().mockReturnValue({
        db: jest.fn().mockReturnValue({
          collection: jest.fn().mockReturnValue({
            findOne: jest.fn().mockReturnValueOnce(null).mockReturnValue({ email: 'test@test.org', password: 'test' }),
          }),
        }),
      }),
    }),
  },
}));

describe('Authorization tests', () => {
  const mockContext = {
    callbackWaitsForEmptyEventLoop: false,
    functionName: 'mockFunctionName',
    functionVersion: 'mockFunctionVersion',
    invokedFunctionArn: 'mockInvokedFunctionArn',
    awsRequestId: 'mockRequestId',
    logGroupName: 'mockLogGroupName',
    logStreamName: 'mockLogStreamName',
    memoryLimitInMB: '128',
    invokeid: 'mockInvokeId',
    getRemainingTimeInMillis: () => 1000,
    done: jest.fn(),
    fail: jest.fn(),
    succeed: jest.fn(),
  };

  const path = '/authorize';
  const httpMethod = 'POST';

  // case 1
  it('email does not exist', async () => {
    const userData = {
      email: 'testing@hackru.org',
      password: 'test',
    };

    const mockEvent = createEvent(userData, path, httpMethod);
    const mockCallback = jest.fn();
    const result = await main(mockEvent, mockContext, mockCallback);

    expect(result.statusCode).toBe(403);
    expect(JSON.parse(result.body).message).toBe('Invalid email');
  });

  // case 2
  it('invalid password', async () => {
    const userData = {
      email: 'test@test.org',
      password: 'hackru',
    };

    const mockEvent = createEvent(userData, path, httpMethod);
    const mockCallback = jest.fn();

    (bcrypt.compare as jest.Mock).mockReturnValue(false);
    const result = await main(mockEvent, mockContext, mockCallback);

    expect(result.statusCode).toBe(403);
    expect(JSON.parse(result.body).message).toBe('Wrong password');
  });

  // case 3
  it('correct email and password', async () => {
    const userData = {
      email: 'test@test.org',
      password: 'test',
    };

    const mockEvent = createEvent(userData, path, httpMethod);
    const mockCallback = jest.fn();

    (bcrypt.compare as jest.Mock).mockReturnValue(true);
    (jwt.sign as jest.Mock).mockReturnValue('mockToken');
    const result = await main(mockEvent, mockContext, mockCallback);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).message).toBe('Authentication Successful');
    expect(JSON.parse(result.body).token).toBeDefined();
    expect(JSON.parse(result.body).token).toBe('mockToken');
  });
});
