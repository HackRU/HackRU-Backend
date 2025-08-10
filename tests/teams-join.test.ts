import { main } from '../src/functions/teams/join/handler';
import { createEvent, mockContext } from './helper';
import * as util from '../src/util';

//mock the db route
const mockUsersCollection = {
  findOne: jest.fn(),
  updateOne: jest.fn(),
};

const mockTeamsCollection = {
  findOne: jest.fn(),
  updateOne: jest.fn(),
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
}));

describe('/teams-join endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const path = '/teams-join';
  const httpMethod = 'POST';

  const usersFindOneMock = mockUsersCollection.findOne as jest.Mock;
  const usersUpdateOneMock = mockUsersCollection.updateOne as jest.Mock;
  const teamsFindOneMock = mockTeamsCollection.findOne as jest.Mock;
  const teamsUpdateOneMock = mockTeamsCollection.updateOne as jest.Mock;
  const validateTokenMock = util.validateToken as jest.Mock;

  it('should join team successfully', async () => {
    validateTokenMock.mockReturnValue(true);

    // First call to find auth user
    usersFindOneMock.mockReturnValueOnce({
      email: 'member@test.com',
      confirmed_team: false,
      team_info: {
        pending_invites: [
          {
            team_id: 'test-team-id-123',
            invited_by: 'leader@test.com',
            invited_at: new Date(),
            team_name: 'Test Team',
          },
        ],
      },
    });

    // Call to find team
    teamsFindOneMock.mockReturnValueOnce({
      team_id: 'test-team-id-123',
      leader_email: 'leader@test.com',
      members: ['existing@test.com'],
      status: 'Active',
      team_name: 'Test Team',
    });

    teamsUpdateOneMock.mockResolvedValue({ acknowledged: true });
    usersUpdateOneMock.mockResolvedValue({ acknowledged: true });

    const mockEvent = createEvent(
      {
        auth_token: 'valid-token',
        auth_email: 'member@test.com',
        team_id: 'test-team-id-123',
      },
      path,
      httpMethod
    );

    const result = await main(mockEvent, mockContext, null);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).message).toBe('Successfully joined team');
    expect(JSON.parse(result.body).team_id).toBe('test-team-id-123');
  });

  it('should reject invalid auth token', async () => {
    validateTokenMock.mockReturnValue(false);

    const mockEvent = createEvent(
      {
        auth_token: 'invalid-token',
        auth_email: 'member@test.com',
        team_id: 'test-team-id-123',
      },
      path,
      httpMethod
    );

    const result = await main(mockEvent, mockContext, null);

    expect(result.statusCode).toBe(401);
    expect(JSON.parse(result.body).message).toBe('Unauthorized - Invalid token');
  });

  it('should reject when auth user not found', async () => {
    validateTokenMock.mockReturnValue(true);
    usersFindOneMock.mockReturnValueOnce(null);

    const mockEvent = createEvent(
      {
        auth_token: 'valid-token',
        auth_email: 'nonexistent@test.com',
        team_id: 'test-team-id-123',
      },
      path,
      httpMethod
    );

    const result = await main(mockEvent, mockContext, null);

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body).message).toBe('Auth user not found');
  });

  it('should reject when user already part of a team', async () => {
    validateTokenMock.mockReturnValue(true);

    usersFindOneMock.mockReturnValueOnce({
      email: 'member@test.com',
      confirmed_team: true,
      team_info: {
        team_id: 'existing-team',
        role: 'member',
      },
    });

    const mockEvent = createEvent(
      {
        auth_token: 'valid-token',
        auth_email: 'member@test.com',
        team_id: 'test-team-id-123',
      },
      path,
      httpMethod
    );

    const result = await main(mockEvent, mockContext, null);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).message).toBe('User is already part of a team');
  });

  it('should reject when no pending invitation found', async () => {
    validateTokenMock.mockReturnValue(true);

    usersFindOneMock.mockReturnValueOnce({
      email: 'member@test.com',
      confirmed_team: false,
      team_info: {
        pending_invites: [
          {
            team_id: 'different-team-id',
            invited_by: 'other@test.com',
            invited_at: new Date(),
            team_name: 'Other Team',
          },
        ],
      },
    });

    const mockEvent = createEvent(
      {
        auth_token: 'valid-token',
        auth_email: 'member@test.com',
        team_id: 'test-team-id-123',
      },
      path,
      httpMethod
    );

    const result = await main(mockEvent, mockContext, null);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).message).toBe('No pending invitation found for this team');
  });

  it('should reject when team not found', async () => {
    validateTokenMock.mockReturnValue(true);

    usersFindOneMock.mockReturnValueOnce({
      email: 'member@test.com',
      confirmed_team: false,
      team_info: {
        pending_invites: [
          {
            team_id: 'test-team-id-123',
            invited_by: 'leader@test.com',
            invited_at: new Date(),
            team_name: 'Test Team',
          },
        ],
      },
    });

    teamsFindOneMock.mockReturnValueOnce(null);

    const mockEvent = createEvent(
      {
        auth_token: 'valid-token',
        auth_email: 'member@test.com',
        team_id: 'test-team-id-123',
      },
      path,
      httpMethod
    );

    const result = await main(mockEvent, mockContext, null);

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body).message).toBe('Team not found');
  });

  it('should reject when team is disbanded', async () => {
    validateTokenMock.mockReturnValue(true);

    usersFindOneMock.mockReturnValueOnce({
      email: 'member@test.com',
      confirmed_team: false,
      team_info: {
        pending_invites: [
          {
            team_id: 'test-team-id-123',
            invited_by: 'leader@test.com',
            invited_at: new Date(),
            team_name: 'Test Team',
          },
        ],
      },
    });

    teamsFindOneMock.mockReturnValueOnce({
      team_id: 'test-team-id-123',
      status: 'Disbanded',
    });

    const mockEvent = createEvent(
      {
        auth_token: 'valid-token',
        auth_email: 'member@test.com',
        team_id: 'test-team-id-123',
      },
      path,
      httpMethod
    );

    const result = await main(mockEvent, mockContext, null);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).message).toBe('Cannot join disbanded team');
  });

  it('should reject when team is at maximum capacity', async () => {
    validateTokenMock.mockReturnValue(true);

    usersFindOneMock.mockReturnValueOnce({
      email: 'member@test.com',
      confirmed_team: false,
      team_info: {
        pending_invites: [
          {
            team_id: 'test-team-id-123',
            invited_by: 'leader@test.com',
            invited_at: new Date(),
            team_name: 'Test Team',
          },
        ],
      },
    });

    teamsFindOneMock.mockReturnValueOnce({
      team_id: 'test-team-id-123',
      leader_email: 'leader@test.com',
      members: ['member1@test.com', 'member2@test.com', 'member3@test.com'], // 3 members + leader = 4 total
      status: 'Active',
    });

    const mockEvent = createEvent(
      {
        auth_token: 'valid-token',
        auth_email: 'member@test.com',
        team_id: 'test-team-id-123',
      },
      path,
      httpMethod
    );

    const result = await main(mockEvent, mockContext, null);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).message).toBe('Team is at maximum capacity');
  });

  it('should handle database operation failure', async () => {
    validateTokenMock.mockReturnValue(true);

    usersFindOneMock.mockReturnValueOnce({
      email: 'member@test.com',
      confirmed_team: false,
      team_info: {
        pending_invites: [
          {
            team_id: 'test-team-id-123',
            invited_by: 'leader@test.com',
            invited_at: new Date(),
            team_name: 'Test Team',
          },
        ],
      },
    });

    teamsFindOneMock.mockReturnValueOnce({
      team_id: 'test-team-id-123',
      leader_email: 'leader@test.com',
      members: [],
      status: 'Active',
    });

    teamsUpdateOneMock.mockRejectedValue(new Error('Database error'));

    const mockEvent = createEvent(
      {
        auth_token: 'valid-token',
        auth_email: 'member@test.com',
        team_id: 'test-team-id-123',
      },
      path,
      httpMethod
    );

    const result = await main(mockEvent, mockContext, null);

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body).message).toBe('Internal server error');
  });
});
