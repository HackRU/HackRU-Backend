import { describe, expect, it } from '@jest/globals';

import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
import { main } from '../src/functions/update/handler';

import { createUpdateEvent, mockContext } from './helper';

jest.mock('../src/util', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention
  MongoDB: {
    getInstance: jest.fn().mockReturnValue({
      connect: jest.fn(),
      disconnect: jest.fn(),
      getCollection: jest.fn().mockReturnValue({
        findOne: jest
          .fn()
          .mockReturnValueOnce(null)
          .mockReturnValueOnce({
            email: 'test@test.org',
            password: 'test',
            role: {
              hacker: false,
              volunteer: true,
              judge: false,
              sponsor: false,
              mentor: false,
              organizer: false,
              director: false,
            },
          })
          .mockReturnValue({
            email: 'test@test.org',
            password: 'test',
            role: {
              hacker: true,
              volunteer: false,
              judge: false,
              sponsor: false,
              mentor: false,
              organizer: false,
              director: false,
            },
          }),
      }),
    }),
  },
  validateToken: jest
    .fn()
    .mockReturnValueOnce(true)
    .mockReturnValueOnce(true)
    .mockReturnValueOnce(true)
    .mockReturnValue(false),
  ensureRoles: jest.fn((roleDict, validRoles) => {
    return validRoles.some((role) => roleDict[role]);
  }),
}));

describe('Update endpoint', () => {
  it('authUser not found', async () => {
    const userData = {
      user_email: 'test@test.org',
      auth_email: 'testAuth@test.org',
      auth_token: 'sampleAuthToken',
      updates: {
        $set: {
          first_name: 'testName',
          last_name: 'testLastName',
        },
      },
    };

    const mockEvent = createUpdateEvent(userData, '/update', 'POST');
    const mockCallback = jest.fn();
    const res = await main(mockEvent, mockContext, mockCallback);
    console.log('authUser not found');
    console.log(res);
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).message).toBe('Auth user not found.');
  });
  it('Invalid user type', async () => {
    const userData = {
      user_email: 'test@test.org',
      auth_email: 'testAuth@test.org',
      auth_token: 'sampleAuthToken',
      updates: {
        $set: {
          first_name: 'testName',
          last_name: 'testLastName',
        },
      },
    };

    const mockEvent = createUpdateEvent(userData, '/update', 'POST');

    const mockCallback = jest.fn();

    const res = await main(mockEvent, mockContext, mockCallback);

    console.log('unauthorized user');
    console.log(res);
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).message).toBe('Unauthorized. Auth user is not an organizer/director/hacker.');
  });
  it('Successfully update', async () => {
    const userData = {
      user_email: 'test@test.org',
      auth_email: 'testAuth@test.org',
      auth_token: 'sampleAuthToken',
      updates: {
        $set: {
          first_name: 'testName',
          last_name: 'testLastName',
        },
      },
    };

    const mockEvent = createUpdateEvent(userData, '/update', 'POST');

    const mockCallback = jest.fn();

    const res = await main(mockEvent, mockContext, mockCallback);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).message).toBe('User updated successfully');
  });
  it('Invalid Token, unauthorized user', async () => {
    const userData = {
      user_email: 'test@test.org',
      auth_email: 'testAuth@test.org',
      auth_token: 'sampleAuthToken',
      updates: {
        $set: {
          first_name: 'testName',
          last_name: 'testLastName',
        },
      },
    };
    const mockEvent = createUpdateEvent(userData, '/update', 'POST');

    const mockCallback = jest.fn();

    const res = await main(mockEvent, mockContext, mockCallback);
    console.log('invalid token');
    console.log(res);
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).message).toBe('Unauthorized');
  });
});
