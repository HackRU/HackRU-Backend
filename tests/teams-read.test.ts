import { main } from '../src/functions/teams/read/handler';
import { createEvent, mockContext } from './helper';
import * as util from '../src/util';

// Mock the database collections
const mockUsersCollection = {
  findOne: jest.fn(),
};

const mockTeamsCollection = {
  findOne: jest.fn(),
};

jest.mock('../src/util', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention
  MongoDB: {
    getInstance: jest.fn().mockReturnValue({
      connect: jest.fn(),
      disconnect: jest.fn(),
      getCollection: jest.fn().mockImplementation((name: string) => {
        if (name === 'users') return mockUsersCollection;
        if (name === 'teams') return mockTeamsCollection;
        return mockUsersCollection;
      }),
    }),
  },
  validateToken: jest.fn(),
  ensureRoles: jest.fn((roleDict, validRoles) => {
    return validRoles.some((role) => roleDict[role]);
  }),
}));

describe('/teams/read endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const path = '/teams/read';
  const httpMethod = 'POST';

  const usersFindOneMock = mockUsersCollection.findOne as jest.Mock;
  const teamsFindOneMock = mockTeamsCollection.findOne as jest.Mock;
  const validateTokenMock = util.validateToken as jest.Mock;

  it('should reject invalid auth token', async () => {
    validateTokenMock.mockReturnValue(false);

    const mockEvent = createEvent(
      {
        auth_token: 'invalid-token',
        auth_email: 'user@test.com',
        team_id: 'test-team-id',
      },
      path,
      httpMethod
    );

    const result = await main(mockEvent, mockContext, null);

    expect(result.statusCode).toBe(401);
    expect(JSON.parse(result.body).message).toBe('Unauthorized');
  });

  it('should reject when auth user not found', async () => {
    validateTokenMock.mockReturnValue(true);
    usersFindOneMock.mockReturnValueOnce(null);

    const mockEvent = createEvent(
      {
        auth_token: 'valid-token',
        auth_email: 'nonexistent@test.com',
        team_id: 'test-team-id',
      },
      path,
      httpMethod
    );

    const result = await main(mockEvent, mockContext, null);

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body).message).toBe('Auth user not found');
  });

  it("should reject unauthorized access to another user's team", async () => {
    validateTokenMock.mockReturnValue(true);

    usersFindOneMock.mockReturnValueOnce({
      email: 'user@test.com',
      role: { hacker: true },
      team_info: { team_id: 'user-team-id' },
    });

    const mockEvent = createEvent(
      {
        auth_token: 'valid-token',
        auth_email: 'user@test.com',
        team_id: 'other-team-id',
      },
      path,
      httpMethod
    );

    const result = await main(mockEvent, mockContext, null);

    expect(result.statusCode).toBe(401);
    expect(JSON.parse(result.body).message).toBe('Unauthorized');
  });

  it('should reject when team not found', async () => {
    validateTokenMock.mockReturnValue(true);

    usersFindOneMock.mockReturnValueOnce({
      email: 'user@test.com',
      role: { hacker: true },
      team_info: { team_id: 'test-team-id' },
    });

    teamsFindOneMock.mockReturnValueOnce(null);

    const mockEvent = createEvent(
      {
        auth_token: 'valid-token',
        auth_email: 'user@test.com',
        team_id: 'test-team-id',
      },
      path,
      httpMethod
    );

    const result = await main(mockEvent, mockContext, null);

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body).message).toBe('Team not found');
  });

  it('should reject when team is not active', async () => {
    validateTokenMock.mockReturnValue(true);

    usersFindOneMock.mockReturnValueOnce({
      email: 'user@test.com',
      role: { hacker: true },
      team_info: { team_id: 'test-team-id' },
    });

    teamsFindOneMock.mockReturnValueOnce({
      team_id: 'test-team-id',
      status: 'Inactive',
    });

    const mockEvent = createEvent(
      {
        auth_token: 'valid-token',
        auth_email: 'user@test.com',
        team_id: 'test-team-id',
      },
      path,
      httpMethod
    );

    const result = await main(mockEvent, mockContext, null);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).message).toBe('Team is not active');
  });

  it('should return team details successfully', async () => {
    validateTokenMock.mockReturnValue(true);

    usersFindOneMock.mockReturnValueOnce({
      email: 'user@test.com',
      role: { hacker: true },
      team_info: { team_id: 'test-team-id' },
    });

    teamsFindOneMock.mockReturnValueOnce({
      team_id: 'test-team-id',
      status: 'Active',
      members: ['user@test.com', 'member2@test.com'],
      leader_email: 'leader@test.com',
    });

    const mockEvent = createEvent(
      {
        auth_token: 'valid-token',
        auth_email: 'user@test.com',
        team_id: 'test-team-id',
      },
      path,
      httpMethod
    );

    const result = await main(mockEvent, mockContext, null);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.message).toBe('Successfully read team');
    expect(body.team).toBeDefined();
    expect(JSON.parse(body.team).team_id).toBe('test-team-id');
  });

  it('should fetch team details using member_email', async () => {
    validateTokenMock.mockReturnValue(true);

    usersFindOneMock
      .mockReturnValueOnce({
        email: 'organizer@test.com',
        role: { organizer: true },
      })
      .mockReturnValueOnce({
        email: 'member@test.com',
        team_info: { team_id: 'test-team-id' },
      });

    teamsFindOneMock.mockReturnValueOnce({
      team_id: 'test-team-id',
      status: 'Active',
      members: ['member@test.com', 'member2@test.com'],
      leader_email: 'leader@test.com',
    });

    const mockEvent = createEvent(
      {
        auth_token: 'valid-token',
        auth_email: 'organizer@test.com',
        member_email: 'member@test.com',
      },
      path,
      httpMethod
    );

    const result = await main(mockEvent, mockContext, null);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.message).toBe('Successfully read team');
    expect(body.team).toBeDefined();
    expect(JSON.parse(body.team).team_id).toBe('test-team-id');
  });
});
