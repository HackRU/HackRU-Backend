// External mock objects created before jest.mock()
const mockSession = {
  withTransaction: jest.fn(),
  endSession: jest.fn(),
};

const mockClient = {
  startSession: jest.fn(() => mockSession),
};

const mockUsersCollection = {
  findOne: jest.fn(),
  updateOne: jest.fn(),
  insertOne: jest.fn(),
};

const mockTeamsCollection = {
  findOne: jest.fn(),
  updateOne: jest.fn(),
  insertOne: jest.fn(),
  deleteOne: jest.fn(),
};

const mockDbInstance = {
  connect: jest.fn(),
  getClient: jest.fn(() => mockClient),
  getCollection: jest.fn((name: string) => {
    if (name === 'users') return mockUsersCollection;
    if (name === 'teams') return mockTeamsCollection;
    return null;
  }),
};

jest.mock('../src/util', () => ({
  validateToken: jest.fn(),
  teamInviteLogic: jest.fn(),
  // eslint-disable-next-line @typescript-eslint/naming-convention
  MongoDB: {
    getInstance: jest.fn(() => mockDbInstance),
  },
}));

import { main } from '../src/functions/teams/create/handler';
import { createEvent, mockContext } from './helper';
import * as util from '../src/util';

describe('Teams Create Handler', () => {
  const validateTokenMock = util.validateToken as jest.Mock;
  const teamInviteLogicMock = util.teamInviteLogic as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    validateTokenMock.mockReturnValue(true);
    teamInviteLogicMock.mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({ message: 'Invitations sent successfully' }),
    });
    mockDbInstance.connect.mockResolvedValue(undefined);
    mockTeamsCollection.insertOne.mockResolvedValue({ acknowledged: true });
    mockUsersCollection.updateOne.mockResolvedValue({ acknowledged: true });
    mockTeamsCollection.deleteOne.mockResolvedValue({ acknowledged: true });

    // Mock transaction to execute the callback immediately
    mockSession.withTransaction.mockImplementation(async (callback) => {
      return await callback();
    });
    mockSession.endSession.mockResolvedValue(undefined);
  });

  const mockEventData = {
    auth_token: 'valid-token',
    auth_email: 'leader@test.com',
    team_name: 'Test Team',
    members: ['member1@test.com', 'member2@test.com'],
  };

  const mockLeaderUser = {
    email: 'leader@test.com',
    confirmed_team: false,
    team_info: null,
  };

  const mockMemberUser = {
    email: 'member1@test.com',
    confirmed_team: false,
    team_info: null,
  };

  it('should successfully create team and send invitations', async () => {
    // Mock user lookups for validation
    mockUsersCollection.findOne
      .mockResolvedValueOnce(mockLeaderUser) // Auth user lookup
      .mockResolvedValueOnce(mockMemberUser) // member1@test.com lookup
      .mockResolvedValueOnce(mockMemberUser); // member2@test.com lookup

    const mockEvent = createEvent(mockEventData, '/teams/create', 'POST');
    const result = await main(mockEvent, mockContext);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.message).toBe('Team created successfully');
    expect(body.team_id).toBeDefined();

    // Verify team creation
    expect(mockTeamsCollection.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        leader_email: 'leader@test.com',
        team_name: 'Test Team',
        members: [],
        status: 'Active',
      }),
      expect.objectContaining({ session: mockSession })
    );

    // Verify leader update
    expect(mockUsersCollection.updateOne).toHaveBeenCalledWith(
      { email: 'leader@test.com' },
      {
        $set: {
          confirmed_team: true,
          team_info: expect.objectContaining({
            role: 'leader',
            pending_invites: [],
          }),
        },
      },
      expect.objectContaining({ session: mockSession })
    );

    // Verify invitations were sent
    expect(teamInviteLogicMock).toHaveBeenCalledWith('leader@test.com', 'valid-token', expect.any(String), [
      'member1@test.com',
      'member2@test.com',
    ]);
  });

  it('should return 401 for invalid token', async () => {
    validateTokenMock.mockReturnValue(false);

    const mockEvent = createEvent(mockEventData, '/teams/create', 'POST');
    const result = await main(mockEvent, mockContext);

    expect(result.statusCode).toBe(401);
    const body = JSON.parse(result.body);
    expect(body.message).toBe('Unauthorized - Invalid token');
  });

  it('should return 404 when auth user not found', async () => {
    mockUsersCollection.findOne.mockResolvedValue(null);

    const mockEvent = createEvent(mockEventData, '/teams/create', 'POST');
    const result = await main(mockEvent, mockContext);

    expect(result.statusCode).toBe(404);
    const body = JSON.parse(result.body);
    expect(body.message).toBe('Auth user not found');
  });

  it('should return 400 when user already leads a team', async () => {
    const leaderWithTeam = {
      ...mockLeaderUser,
      team_info: { role: 'leader', team_id: 'existing-team' },
    };
    mockUsersCollection.findOne.mockResolvedValue(leaderWithTeam);

    const mockEvent = createEvent(mockEventData, '/teams/create', 'POST');
    const result = await main(mockEvent, mockContext);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.message).toBe('User already leads a team');
  });

  it('should return 400 when user is already part of a team', async () => {
    const userInTeam = {
      ...mockLeaderUser,
      confirmed_team: true,
    };
    mockUsersCollection.findOne.mockResolvedValue(userInTeam);

    const mockEvent = createEvent(mockEventData, '/teams/create', 'POST');
    const result = await main(mockEvent, mockContext);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.message).toBe('User is already part of a team');
  });

  it('should return 400 when some member emails do not exist', async () => {
    mockUsersCollection.findOne
      .mockResolvedValueOnce(mockLeaderUser) // Auth user lookup
      .mockResolvedValueOnce(null) // member1@test.com lookup - doesn't exist
      .mockResolvedValueOnce(mockMemberUser); // member2@test.com lookup

    const mockEvent = createEvent(mockEventData, '/teams/create', 'POST');
    const result = await main(mockEvent, mockContext);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.message).toBe('Some users do not exist');
    expect(body.invalid_emails).toContain('member1@test.com');
  });

  it('should return 400 when some members are already in teams', async () => {
    const memberInTeam = {
      ...mockMemberUser,
      confirmed_team: true,
    };

    mockUsersCollection.findOne
      .mockResolvedValueOnce(mockLeaderUser) // Auth user lookup
      .mockResolvedValueOnce(memberInTeam) // member1@test.com lookup - already in team
      .mockResolvedValueOnce(mockMemberUser); // member2@test.com lookup

    const mockEvent = createEvent(mockEventData, '/teams/create', 'POST');
    const result = await main(mockEvent, mockContext);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.message).toBe('Some users are already part of teams');
    expect(body.users_in_teams).toContain('member1@test.com');
  });

  it('should return 400 when team size exceeds maximum', async () => {
    const oversizedTeamData = {
      ...mockEventData,
      members: ['member1@test.com', 'member2@test.com', 'member3@test.com', 'member4@test.com'], // 5 total with leader
    };

    mockUsersCollection.findOne.mockResolvedValue(mockLeaderUser);

    const mockEvent = createEvent(oversizedTeamData, '/teams/create', 'POST');
    const result = await main(mockEvent, mockContext);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.message).toBe('Team size cannot exceed 4 members (including leader)');
  });

  it('should rollback transaction when invitation sending fails', async () => {
    // Setup successful validation
    mockUsersCollection.findOne
      .mockResolvedValueOnce(mockLeaderUser) // Auth user lookup
      .mockResolvedValueOnce(mockMemberUser) // member1@test.com lookup
      .mockResolvedValueOnce(mockMemberUser); // member2@test.com lookup

    // Make invitation logic fail
    teamInviteLogicMock.mockResolvedValue({
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to send invitations' }),
    });

    const mockEvent = createEvent(mockEventData, '/teams/create', 'POST');
    const result = await main(mockEvent, mockContext);

    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body);
    expect(body.message).toBe('Failed to create team');

    // Verify transaction was attempted
    expect(mockSession.withTransaction).toHaveBeenCalled();

    // Verify session cleanup
    expect(mockSession.endSession).toHaveBeenCalled();

    // No manual cleanup needed since transaction handles rollback automatically
  });

  it('should handle database errors gracefully', async () => {
    mockUsersCollection.findOne.mockRejectedValue(new Error('Database error'));

    const mockEvent = createEvent(mockEventData, '/teams/create', 'POST');
    const result = await main(mockEvent, mockContext);

    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body);
    expect(body.message).toBe('Internal server error');
    expect(body.error).toBe('Database error');
  });

  it('should normalize email addresses to lowercase', async () => {
    const uppercaseEmailData = {
      ...mockEventData,
      auth_email: 'LEADER@TEST.COM',
      members: ['MEMBER1@TEST.COM', 'member2@test.com'],
    };

    mockUsersCollection.findOne
      .mockResolvedValueOnce(mockLeaderUser) // Auth user lookup
      .mockResolvedValueOnce(mockMemberUser) // member1@test.com lookup
      .mockResolvedValueOnce(mockMemberUser); // member2@test.com lookup

    const mockEvent = createEvent(uppercaseEmailData, '/teams/create', 'POST');
    const result = await main(mockEvent, mockContext);

    expect(result.statusCode).toBe(200);

    // Verify team creation uses lowercase email
    expect(mockTeamsCollection.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        leader_email: 'leader@test.com', // Should be lowercase
      }),
      expect.objectContaining({ session: mockSession })
    );

    // Verify invitations are sent with lowercase emails
    expect(teamInviteLogicMock).toHaveBeenCalledWith(
      'LEADER@TEST.COM', // Original auth_email
      'valid-token',
      expect.any(String),
      ['member1@test.com', 'member2@test.com'] // Should be lowercase
    );
  });

  it('should return 400 for empty team name', async () => {
    const emptyNameData = {
      ...mockEventData,
      team_name: '   ', // Just whitespace
    };

    const mockEvent = createEvent(emptyNameData, '/teams/create', 'POST');
    const result = await main(mockEvent, mockContext);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.message).toBe('Team name cannot be empty');
  });

  it('should return 400 for team name exceeding 50 characters', async () => {
    const longNameData = {
      ...mockEventData,
      team_name: 'A'.repeat(51), // 51 characters
    };

    const mockEvent = createEvent(longNameData, '/teams/create', 'POST');
    const result = await main(mockEvent, mockContext);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.message).toBe('Team name cannot exceed 50 characters');
  });

  it('should return 400 for team name with invalid characters', async () => {
    const invalidNameData = {
      ...mockEventData,
      team_name: 'Team@Name!', // Contains @ and !
    };

    const mockEvent = createEvent(invalidNameData, '/teams/create', 'POST');
    const result = await main(mockEvent, mockContext);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.message).toBe('Team name can only contain letters, numbers, spaces, hyphens, and underscores');
  });

  it('should accept valid team name with allowed characters', async () => {
    const validNameData = {
      ...mockEventData,
      team_name: 'Team_Name-123 Valid', // Valid characters
    };

    // Mock user lookups for validation
    mockUsersCollection.findOne
      .mockResolvedValueOnce(mockLeaderUser) // Auth user lookup
      .mockResolvedValueOnce(mockMemberUser) // member1@test.com lookup
      .mockResolvedValueOnce(mockMemberUser); // member2@test.com lookup

    const mockEvent = createEvent(validNameData, '/teams/create', 'POST');
    const result = await main(mockEvent, mockContext);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.message).toBe('Team created successfully');

    // Verify team creation uses trimmed name
    expect(mockTeamsCollection.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        team_name: 'Team_Name-123 Valid',
      }),
      expect.objectContaining({ session: mockSession })
    );
  });
});
