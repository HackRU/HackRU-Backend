import { describe, expect, it } from '@jest/globals';

import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
import { main } from '../src/functions/create/handler';

interface Event {
  body: string;
  path: string;
  httpMethod: string;
  headers: Record<string, string>;
  multiValueHeaders: Record<string, string[]>;
  isBase64Encoded: boolean;
  pathParameters: null | Record<string, string>;
  queryStringParameters: null | Record<string, string>;
  multiValueQueryStringParameters: null | Record<string, string[]>;
  requestContext: null;
  resource: string;
  stageVariables: null | Record<string, string>;
  rawBody: string;
}

// creating mock event for all tests
function createMockEvent(userData: Record<string, string>, path: string, httpMethod: string): Event {
  return {
    body: JSON.stringify(userData),
    headers: {},
    multiValueHeaders: {},
    httpMethod: httpMethod,
    isBase64Encoded: false,
    path: path,
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as any,
    resource: '',
    rawBody: JSON.stringify(userData),
  };
}
interface Context {
  callbackWaitsForEmptyEventLoop: boolean;
  functionName: string;
  functionVersion: string;
  invokedFunctionArn: string;
  awsRequestId: string;
  logGroupName: string;
  logStreamName: string;
  memoryLimitInMB: string;
  invokeid: string;
  getRemainingTimeInMillis: () => number;
  done: () => {};
  fail: () => {};
  succeed: () => {};
}

//helper function to mock the context for each test
function createMockContext(): Context {
  return {
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
}

const bcrypt = require('bcryptjs');
jest.mock('bcryptjs');

//mock the db route
jest.mock('../src/util', () => ({
  MongoDB: {
    getInstance: jest.fn().mockReturnValue({
      connect: jest.fn(),
      disconnect: jest.fn(),

      getCollection: jest.fn().mockReturnValue({
        findOne: jest.fn().mockReturnValueOnce({ email: 'test@test.org', password: 'test' }).mockReturnValue(null),
        insertOne: jest.fn(),
      }),
    }),
  },
}));

jest.mock('../src/config.ts', () => ({
  registrationStart: '06/02/2024',
  registrationEnd: '06/30/2024',
}));

describe('Create endpoint', () => {
  it('Duplicate User', async () => {
    const mockEvent = createMockEvent({ email: 'testEmail@gmail.com', password: 'testPassword123' }, '/create', 'POST');
    const mockContext = createMockContext();

    const mockCallback = jest.fn();

    bcrypt.hash.mockResolvedValue('hashedPassword');

    const res = await main(mockEvent, mockContext, mockCallback);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).message).toBe('Duplicate user!');
  });
  it('Create a new user', async () => {
    const mockEvent = createMockEvent({ email: 'testEmail@gmail.com', password: 'testPassword123' }, '/create', 'POST');
    const mockContext = createMockContext();

    const mockCallback = jest.fn();

    bcrypt.hash.mockResolvedValue('hashedPassword');
    const res = await main(mockEvent, mockContext, mockCallback);

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).message).toBe('User created!');
  });
  it('Registration time has passed', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('07/01/2024'));

    const mockEvent = createMockEvent({ email: 'testEmail@gmail.com', password: 'testPassword123' }, '/create', 'POST');
    const mockContext = createMockContext();
    const mockCallback = jest.fn();
    const res = await main(mockEvent, mockContext, mockCallback);

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).message).toBe('Registration is closed!');
  });
});
