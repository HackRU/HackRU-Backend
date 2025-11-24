// External mock objects created before jest.mock()
const mockUsersCollection = {
  findOne: jest.fn(),
  updateOne: jest.fn(),
};

const mockTeamsCollection = {
  findOne: jest.fn(),
  updateOne: jest.fn(),
};

const mockDbInstance = {
  connect: jest.fn(),
  getCollection: jest.fn((name) => {
    if (name === 'users') return mockUsersCollection;
    if (name === 'teams') return mockTeamsCollection;
    return null;
  }),
};

jest.mock('../src/util', () => ({
  validateToken: jest.fn(),
  // eslint-disable-next-line @typescript-eslint/naming-convention
  MongoDB: {
    getInstance: jest.fn(() => mockDbInstance),
  },
}));

import { main } from '../src/functions/teams/member-removal/handler';
import { createEvent, mockContext } from './helper';
import * as util from '../src/util';

describe('Teams Member Removal Handler', () => {
  const validateTokenMock = util.validateToken as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    validateTokenMock.mockReturnValue(true);
    mockDbInstance.connect.mockResolvedValue(undefined);
  });

  const mockEventData = {
    auth_token: 'valid-token',
    auth_email: 'leader@test.com',
    team_id: 'team123',
    member_emails: ['member1@test.com', 'member2@test.com'],
  };

  const mockEvent = createEvent(mockEventData, '/teams/member-removal', 'POST');

  const mockLeaderUser = {
    email: 'leader@test.com',
    confirmed_team: true,
    team_info: {
      team_id: 'team123',
      role: 'leader',
      pending_invites: [],
    },
  };

  const mockTeam = {
    team_id: 'team123',
    leader_email: 'leader@test.com',
    members: ['member1@test.com', 'member2@test.com', 'member3@test.com'],
    status: 'Active',
    team_name: 'Test Team',
    created: new Date(),
    updated: new Date(),
  };

  it('should successfully remove members from team', async () => {
    // Mock leader user lookup
    mockUsersCollection.findOne
      .mockResolvedValueOnce(mockLeaderUser) // Auth user lookup
      .mockResolvedValueOnce({
        // member1@test.com lookup
        email: 'member1@test.com',
        confirmed_team: true,
        team_info: {
          team_id: 'team123',
          role: 'member',
          pending_invites: [],
        },
      })
      .mockResolvedValueOnce({
        // member2@test.com lookup
        email: 'member2@test.com',
        confirmed_team: true,
        team_info: {
          team_id: 'team123',
          role: 'member',
          pending_invites: [],
        },
      });

    mockTeamsCollection.findOne.mockResolvedValue(mockTeam);
    mockTeamsCollection.updateOne.mockResolvedValue({ acknowledged: true });
    mockUsersCollection.updateOne.mockResolvedValue({ acknowledged: true });

    const result = await main(mockEvent, mockContext);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.message).toBe('Team members removed successfully');
    expect(body.members_affected).toBe(2);

    // Verify team updates (called twice for $pull operations)
    expect(mockTeamsCollection.updateOne).toHaveBeenCalledTimes(2);
    expect(mockTeamsCollection.updateOne).toHaveBeenCalledWith(
      { team_id: 'team123' },
      {
        $pull: { members: 'member1@test.com' },
        $set: { updated: expect.any(Date) },
      }
    );

    // Verify user updates (called twice for two removed members)
    expect(mockUsersCollection.updateOne).toHaveBeenCalledTimes(2);
  });

  it('should return 401 for invalid token', async () => {
    validateTokenMock.mockReturnValue(false);

    const invalidTokenEvent = createEvent(mockEventData, '/teams/member-removal', 'POST');
    const result = await main(invalidTokenEvent, mockContext);

    expect(result.statusCode).toBe(401);
    const body = JSON.parse(result.body);
    expect(body.message).toBe('Unauthorized - Invalid token');
  });

  it('should return 404 when auth user not found', async () => {
    mockUsersCollection.findOne.mockResolvedValue(null);

    const userNotFoundEvent = createEvent(mockEventData, '/teams/member-removal', 'POST');
    const result = await main(userNotFoundEvent, mockContext);

    expect(result.statusCode).toBe(404);
    const body = JSON.parse(result.body);
    expect(body.message).toBe('Auth user not found');
  });

  it('should return 404 when team not found', async () => {
    mockUsersCollection.findOne.mockResolvedValue(mockLeaderUser);
    mockTeamsCollection.findOne.mockResolvedValue(null);

    const teamNotFoundEvent = createEvent(mockEventData, '/teams/member-removal', 'POST');
    const result = await main(teamNotFoundEvent, mockContext);

    expect(result.statusCode).toBe(404);
    const body = JSON.parse(result.body);
    expect(body.message).toBe('Team not found');
  });

  it('should return 400 when team is disbanded', async () => {
    mockUsersCollection.findOne.mockResolvedValue(mockLeaderUser);
    mockTeamsCollection.findOne.mockResolvedValue({
      ...mockTeam,
      status: 'Disbanded',
    });

    const disbandedTeamEvent = createEvent(mockEventData, '/teams/member-removal', 'POST');
    const result = await main(disbandedTeamEvent, mockContext);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.message).toBe('Cannot remove members from disbanded team');
  });

  it('should return 403 when non-leader tries to remove members', async () => {
    const nonLeaderUser = {
      ...mockLeaderUser,
      email: 'member@test.com',
      team_info: {
        ...mockLeaderUser.team_info,
        role: 'member',
      },
    };

    mockUsersCollection.findOne.mockResolvedValue(nonLeaderUser);
    mockTeamsCollection.findOne.mockResolvedValue(mockTeam);

    const eventWithNonLeader = createEvent(
      {
        ...mockEventData,
        auth_email: 'member@test.com',
      },
      '/teams/member-removal',
      'POST'
    );

    const result = await main(eventWithNonLeader, mockContext);

    expect(result.statusCode).toBe(403);
    const body = JSON.parse(result.body);
    expect(body.message).toBe('Only team leader can remove members');
  });

  it('should handle removing pending invites', async () => {
    // Mock leader user lookup
    mockUsersCollection.findOne
      .mockResolvedValueOnce(mockLeaderUser) // Auth user lookup
      .mockResolvedValueOnce({
        // user with pending invite
        email: 'invited@test.com',
        confirmed_team: false,
        team_info: {
          team_id: null,
          role: null,
          pending_invites: [
            {
              team_id: 'team123',
              invited_by: 'leader@test.com',
              invited_at: new Date(),
              team_name: 'Test Team',
            },
          ],
        },
      });

    mockTeamsCollection.findOne.mockResolvedValue(mockTeam);
    mockUsersCollection.updateOne.mockResolvedValue({ acknowledged: true });

    const eventWithPendingInvite = createEvent(
      {
        ...mockEventData,
        member_emails: ['invited@test.com'],
      },
      '/teams/member-removal',
      'POST'
    );

    const result = await main(eventWithPendingInvite, mockContext);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.message).toBe('Team members removed successfully');
    expect(body.members_affected).toBe(1);

    // Verify user update (removing pending invite)
    expect(mockUsersCollection.updateOne).toHaveBeenCalledWith(
      { email: 'invited@test.com' },
      {
        $set: {
          'team_info.pending_invites': [],
        },
      }
    );
  });

  it('should return 400 when leader tries to remove themselves', async () => {
    mockUsersCollection.findOne.mockResolvedValue(mockLeaderUser);
    mockTeamsCollection.findOne.mockResolvedValue(mockTeam);

    const eventWithLeaderRemoval = createEvent(
      {
        ...mockEventData,
        member_emails: ['leader@test.com', 'member1@test.com'],
      },
      '/teams/member-removal',
      'POST'
    );

    const result = await main(eventWithLeaderRemoval, mockContext);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.message).toBe('Team leader cannot remove themselves from the team');
  });

  it('should skip non-existent users and return members_affected count', async () => {
    mockUsersCollection.findOne
      .mockResolvedValueOnce(mockLeaderUser) // Auth user lookup
      .mockResolvedValueOnce(null) // nonexistent@test.com lookup
      .mockResolvedValueOnce({
        // member1@test.com lookup
        email: 'member1@test.com',
        confirmed_team: true,
        team_info: {
          team_id: 'team123',
          role: 'member',
          pending_invites: [],
        },
      });

    mockTeamsCollection.findOne.mockResolvedValue(mockTeam);
    mockTeamsCollection.updateOne.mockResolvedValue({ acknowledged: true });
    mockUsersCollection.updateOne.mockResolvedValue({ acknowledged: true });

    const eventWithNonexistentUser = createEvent(
      {
        ...mockEventData,
        member_emails: ['nonexistent@test.com', 'member1@test.com'],
      },
      '/teams/member-removal',
      'POST'
    );

    const result = await main(eventWithNonexistentUser, mockContext);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.message).toBe('Team members removed successfully');
    expect(body.members_affected).toBe(1); // Only member1@test.com was affected

    // Verify only one team update (for existing member)
    expect(mockTeamsCollection.updateOne).toHaveBeenCalledTimes(1);
    expect(mockUsersCollection.updateOne).toHaveBeenCalledTimes(1);
  });

  it('should handle database errors gracefully', async () => {
    mockUsersCollection.findOne.mockRejectedValue(new Error('Database error'));

    const databaseErrorEvent = createEvent(mockEventData, '/teams/member-removal', 'POST');
    const result = await main(databaseErrorEvent, mockContext);

    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body);
    expect(body.message).toBe('Internal server error');
    expect(body.error).toBe('Database error');
  });
});
