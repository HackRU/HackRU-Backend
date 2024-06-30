import { beforeEach, describe, expect, it } from '@jest/globals';

import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
import { main } from '../src/functions/update/handler';

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
  validateToken: jest
    .fn()
    .mockReturnValueOnce(true)
    .mockReturnValueOnce(true)
    .mockReturnValueOnce(true)
    .mockReturnValueOnce(true)
    .mockReturnValueOnce(true)
    .mockReturnValueOnce(true)
    .mockReturnValueOnce(true)
    .mockReturnValue(false),
  ensureRoles: jest.fn((roleDict, validRoles) => {
    return validRoles.some((role) => roleDict[role]);
  }),
}));

describe('Update endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

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
  const findOneMock = util.MongoDB.getInstance('uri').getCollection('users').findOne as jest.Mock;
  const mockCallback = jest.fn();
  //case 1
  it('authUser not found', async () => {
    findOneMock.mockReturnValueOnce(null);
    const mockEvent = createEvent(userData, '/update', 'POST');
    const res = await main(mockEvent, mockContext, mockCallback);

    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).message).toBe('Auth user not found.');
  });
  //case 2
  it('Invalid user type', async () => {
    findOneMock.mockReturnValueOnce({
      //not hacker/director/organizer
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
    });
    const mockEvent = createEvent(userData, '/update', 'POST');
    const res = await main(mockEvent, mockContext, mockCallback);

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).message).toBe('Unauthorized. Auth user is not an organizer/director/hacker.');
  });
  //case 3
  it('User to be updated not found', async () => {
    findOneMock
      .mockReturnValueOnce({
        //user to be updated not found, authUser found
        email: 'testAuth@test.org',
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
      })
      .mockReturnValueOnce(null); //user to be updated not found
    const mockEvent = createEvent(userData, '/update', 'POST');
    const res = await main(mockEvent, mockContext, mockCallback);
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).message).toBe('User to be updated not found.');
  });
  //case 4
  it('invalid updates', async () => {
    const invalidUserData = [
      {
        userData: {
          user_email: 'test@test.org',
          auth_email: 'testAuth@test.org',
          auth_token: 'sampleAuthToken',
          updates: {
            $set: {
              first_name: 'testName',
              last_name: 'testLastName',
              registration_status: 'unregistered',
            },
          },
        },
      },
      {
        userData: {
          user_email: 'test@test.org',
          auth_email: 'testAuth@test.org',
          auth_token: 'sampleAuthToken',
          updates: {
            $set: {
              first_name: 'testName',
              last_name: 'testLastName',
              registration_status: 'unregistered',
              password: 'test',
            },
          },
        },
      },
      {
        userData: {
          user_email: 'test@test.org',
          auth_email: 'testAuth@test.org',
          auth_token: 'sampleAuthToken',
          updates: {
            $set: {
              first_name: 'testName',
              last_name: 'testLastName',
              registration_status: 'unknown',
            },
          },
        },
      },
    ];
    for (const invalidUpdate of invalidUserData) {
      jest.clearAllMocks();
      findOneMock.mockReturnValue({
        //successful update
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
      });
      const mockEvent = createEvent(invalidUpdate.userData, '/update', 'POST');
      const res = await main(mockEvent, mockContext, mockCallback);
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).message).toBe('Bad updates.');
    }
  });
  //case 5
  it('Successfully update', async () => {
    findOneMock.mockReturnValue({
      //successful update
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
    });
    const mockEvent = createEvent(userData, '/update', 'POST');

    const res = await main(mockEvent, mockContext, mockCallback);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).message).toBe('User updated successfully');
  });
  //case 6
  it('Invalid Token, unauthorized user', async () => {
    findOneMock.mockReturnValue({
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
    });
    const mockEvent = createEvent(userData, '/update', 'POST');

    const res = await main(mockEvent, mockContext, mockCallback);
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).message).toBe('Unauthorized');
  });
});
