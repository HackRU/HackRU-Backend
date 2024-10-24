import { beforeEach, describe, expect, it } from '@jest/globals';

import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
import { main } from '../src/functions/update/handler';

import { createEvent, mockContext, Updates } from './helper';
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
  ensureRoles: jest.fn((roleDict, validRoles) => {
    return validRoles.some((role) => roleDict[role]);
  }),
}));

describe('/update endpoint', () => {
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
  it('Invalid auth token', async () => {
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

  // case 2
  it('authUser not found', async () => {
    findOneMock.mockReturnValueOnce(null);
    const mockEvent = createEvent(userData, '/update', 'POST');
    const res = await main(mockEvent, mockContext, mockCallback);

    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).message).toBe('Auth user not found.');
  });

  //case 3
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

  //case 4
  it('User to be updated not found', async () => {
    findOneMock
      .mockReturnValueOnce({
        // authUser found
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

  //case 5
  it('invalid updates', async () => {
    const invalidUserData: Record<string, string | boolean | number | Updates>[] = [
      {
        user_email: 'test@test.org',
        auth_email: 'testAuth@test.org',
        auth_token: 'sampleAuthToken',
        updates: {
          $set: {
            registration_status: 'coming', // case where registration_status does not follow order (unregistered -> coming)
          },
        },
      },
      {
        user_email: 'test@test.org',
        auth_email: 'testAuth@test.org',
        auth_token: 'sampleAuthToken',
        updates: {
          $set: {
            password: 'test', // making updates to either password or _id is forbidden
            // eslint-disable-next-line @typescript-eslint/naming-convention
            _id: 'abcd',
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
        registration_status: 'registered',
      });
      const mockEvent = createEvent(invalidUpdate, '/update', 'POST');
      const res = await main(mockEvent, mockContext, mockCallback);
      expect(res.statusCode).toBe(400);
      /*
        The reason this message is being commented out is because with the new error messages,
        the error message will be different depending on what field is being updated.

        For example, password being update will have different message from registration_status being
        updated to a value that is not a part of the graph.
      */
      // expect(JSON.parse(res.body).message).toBe('Invalid registration status update from registered to coming');
    }
  });

  //case 6
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
  //cause 7
  it('Incomplete fields for registration', async () => {
    const incompleteUserData = {
      user_email: 'test@test.org',
      auth_email: 'testAuth@test.org',
      auth_token: 'sampleAuthToken',
      updates: {
        $set: {
          registration_status: 'registered',
        },
      },
    };
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
    const mockEvent = createEvent(incompleteUserData, '/update', 'POST');
    const res = await main(mockEvent, mockContext, mockCallback);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).message).toBe('Missing required fields');
  });
  //case 8
  it('Completed fields for registration, success', async () => {
    const completeUserData = {
      user_email: 'test@test.org',
      auth_email: 'testAuth@test.org',
      auth_token: 'sampleAuthToken',
      updates: {
        $set: {
          registration_status: 'registered',
        },
      },
    };
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
      registration_status: 'unregistered',
      link: 'testLink',
      github: 'testGithub',
      major: 'sampleMajor',
      short_answer: 'sample answer',
      shirt_size: 'S',
      first_name: 'firstName',
      last_name: 'lastName',
      dietary_restrictions: 'none',
      special_needs: 'none',
      date_of_birth: '01/01/2000',
      school: 'Rutgers',
      grad_year: '2024',
      gender: 'gender',
      level_of_study: 'studyLevel',
      ethnicity: 'sampleEthnicity',
      phone_number: 'sampleNumber',
    });

    const mockEvent = createEvent(completeUserData, '/update', 'POST');
    const res = await main(mockEvent, mockContext, mockCallback);
    expect(res.statusCode).toBe(200);
  });
});
