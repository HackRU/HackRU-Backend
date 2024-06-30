interface MockEvent {
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

interface Updates {
  $set?: Record<string, boolean | string | number>;
}

export function createEvent(
  userData: Record<string, string | boolean | number | Updates>,
  path: string,
  httpMethod: string
): MockEvent {
  const event = {
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

export const mockContext = {
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
