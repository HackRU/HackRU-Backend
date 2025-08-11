import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { main } from '../src/functions/teams/invite/handler';
import { createEvent, mockContext } from './helper';
import { MongoDB, validateToken, userExistsLogic } from '../src/util';

jest.mock('../src/util', () => {
  const original = jest.requireActual('../src/util');
  return {
    ...original,
    validateToken: jest.fn(),
    userExistsLogic: jest.fn(),
    MongoDB: {
      getInstance: jest.fn(),
    },
  };
});

// minimal typed shapes for our jest-mocked collections/clients
type UsersCol = {
  findOne: jest.Mock;
  countDocuments: jest.Mock;
  updateOne: jest.Mock;
};

type TeamsCol = {
  findOne: jest.Mock;
};

type ClientMock = {
  startSession: jest.Mock;
};

type DbMock = {
  connect: jest.Mock;
  getClient: jest.Mock;
  getCollection: jest.Mock;
};

describe('POST /teams/invite handler', () => {
  const path = '/teams/invite';
  const method = 'POST';
  const baseBody = {
    auth_token: 'tok',
    auth_email: 'leader@example.com',
    team_id: 'team123',
    emails: ['alice@example.com', 'bob@example.com'],
  };

  let mockUsers: UsersCol;
  let mockTeams: TeamsCol;
  let mockClient: ClientMock & { startSession: jest.Mock };
  let mockDb: DbMock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Default: token is valid
    (validateToken as jest.Mock).mockReturnValue(true);

    // Mock collections
    mockUsers = {
      findOne: jest.fn(),
      countDocuments: jest.fn(),
      updateOne: jest.fn(),
    };
    mockTeams = {
      findOne: jest.fn(),
    };

    const session = { withTransaction: (fn: (s?: unknown) => unknown) => fn(), endSession: jest.fn() };
    mockClient = {
      startSession: jest.fn().mockReturnValue(session),
    } as unknown as ClientMock & { startSession: jest.Mock };

    mockDb = {
      connect: jest.fn(),
      getClient: jest.fn().mockReturnValue(mockClient),
      getCollection: jest.fn((name: string) => (name === 'users' ? mockUsers : mockTeams)),
    };

    // MongoDB.getInstance() => mockDb
    (MongoDB.getInstance as jest.Mock).mockReturnValue(mockDb);
  });

  it('returns 401 if token invalid', async () => {
    (validateToken as jest.Mock).mockReturnValue(false);
    const ev = createEvent(baseBody, path, method);
    const res = await main(ev, mockContext, jest.fn()); // no-empty-function → use jest.fn()

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body)).toEqual({ message: 'Unauthorized' });
  });

  it('returns 404 if auth user not found', async () => {
    mockUsers.findOne.mockResolvedValueOnce(null);
    const ev = createEvent(baseBody, path, method);
    const res = await main(ev, mockContext, jest.fn());

    expect(mockUsers.findOne).toHaveBeenCalledWith({ email: 'leader@example.com' });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body)).toEqual({ message: 'Auth user not found' });
  });

  it('returns 404 if team not found', async () => {
    mockUsers.findOne.mockResolvedValueOnce({ email: 'leader@example.com' });
    mockTeams.findOne.mockResolvedValueOnce(null);
    const ev = createEvent(baseBody, path, method);
    const res = await main(ev, mockContext, jest.fn());

    expect(mockTeams.findOne).toHaveBeenCalledWith({ team_id: 'team123' });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body)).toEqual({ message: 'Team not found' });
  });

  it('returns 403 if caller is not leader', async () => {
    mockUsers.findOne.mockResolvedValueOnce({ email: 'leader@example.com' });
    mockTeams.findOne.mockResolvedValueOnce({
      team_id: 'team123',
      leader_email: 'other@example.com',
      members: [],
    });
    const ev = createEvent(baseBody, path, method);
    const res = await main(ev, mockContext, jest.fn());

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body)).toEqual({ message: 'Auth user is not the team leader' });
  });

  it('returns 400 if no slots available', async () => {
    mockUsers.findOne.mockResolvedValueOnce({ email: 'leader@example.com' });
    mockTeams.findOne.mockResolvedValueOnce({
      team_id: 'team123',
      leader_email: 'leader@example.com',
      members: ['a', 'b', 'c', 'd'],
    });
    mockUsers.countDocuments.mockResolvedValueOnce(0);
    const ev = createEvent(baseBody, path, method);
    const res = await main(ev, mockContext, jest.fn());

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body)).toEqual({ message: 'Team is already full' });
  });

  it('processes invites: alice success, bob fails userExists', async () => {
    mockUsers.findOne.mockResolvedValueOnce({ email: 'leader@example.com' });
    mockTeams.findOne.mockResolvedValueOnce({
      team_id: 'team123',
      leader_email: 'leader@example.com',
      members: [],
    });
    mockUsers.countDocuments.mockResolvedValueOnce(0);

    (userExistsLogic as jest.Mock)
      .mockResolvedValueOnce({ statusCode: 200, body: '"User exists"' })
      .mockResolvedValueOnce({ statusCode: 404, body: '{}' });

    mockUsers.findOne.mockResolvedValueOnce({
      email: 'alice@example.com',
      confirmed_team: false,
      team_info: { pending_invites: [] },
    });

    mockUsers.updateOne.mockResolvedValueOnce({});

    const ev = createEvent(baseBody, path, method);
    const res = await main(ev, mockContext, jest.fn());

    const body = JSON.parse(res.body);
    expect(res.statusCode).toBe(200);
    expect(body).toEqual({
      message: 'Invitations sent successfully',
      invited: ['alice@example.com'],
      failed: [{ email: 'bob@example.com', reason: 'User does not exist or unauthorized' }],
    });

    expect(mockUsers.updateOne).toHaveBeenCalledWith(
      { email: 'alice@example.com' },
      {
        $push: {
          'team_info.pending_invites': expect.objectContaining({
            team_id: 'team123',
            invited_by: 'leader@example.com',
          }),
        },
      },
      { session: expect.any(Object) }
    );
  });

  it('rolls back and returns 500 if transaction throws', async () => {
    mockUsers.findOne.mockResolvedValueOnce({ email: 'leader@example.com' });
    mockTeams.findOne.mockResolvedValueOnce({
      team_id: 'team123',
      leader_email: 'leader@example.com',
      members: [],
    });
    mockUsers.countDocuments.mockResolvedValueOnce(0);

    // force txn error
    const badSession = {
      withTransaction: () => {
        throw new Error('Txn failed');
      },
      endSession: jest.fn(),
    };
    (mockClient.startSession as jest.Mock).mockReturnValueOnce(badSession);

    const ev = createEvent(baseBody, path, method);
    const res = await main(ev, mockContext, jest.fn());

    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body)).toEqual({
      message: 'Internal server error during invitation processing',
    });
  });
});
