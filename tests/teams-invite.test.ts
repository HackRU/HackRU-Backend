// tests/teams-invite.test.ts
import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { main } from '../src/functions/teams/invite/handler';
import { createEvent, mockContext } from './helper';
import { MongoDB, validateToken, userExistsLogic } from '../src/util';
import type { TeamDocument, UserDocument } from '../src/types';

interface UserExistsResp {
  statusCode: number;
  body: string;
}

jest.mock('../src/util', () => ({
  validateToken: jest.fn<(...args: unknown[]) => boolean>(),
  userExistsLogic: jest.fn<(...args: unknown[]) => Promise<UserExistsResp>>(),
  MongoDB: { getInstance: jest.fn() },
}));

type Maybe<T> = T | null;

// ---- Standalone, strongly-typed mocks (use THESE at call sites) ----
const usersFindOne = jest.fn<(...args: unknown[]) => Promise<Maybe<UserDocument>>>();
const usersCountDocuments = jest.fn<(...args: unknown[]) => Promise<number>>();
const usersUpdateOne = jest.fn<(...args: unknown[]) => Promise<{ modifiedCount?: number }>>();

const teamsFindOne = jest.fn<(...args: unknown[]) => Promise<Maybe<TeamDocument>>>();

const sessionWithTransaction = jest.fn<(fn: (s?: unknown) => unknown) => Promise<unknown>>();
const sessionEndSession = jest.fn<() => void>();

const clientStartSession =
  jest.fn<() => { withTransaction: typeof sessionWithTransaction; endSession: typeof sessionEndSession }>();

const dbConnect = jest.fn<() => Promise<void>>();
const dbGetClient = jest.fn<() => ReturnType<typeof clientStartSession>>();
const dbGetCollection = jest.fn<(name: string) => unknown>();

// Objects returned by getCollection (wired to standalone mocks)
const mockUsers = {
  findOne: usersFindOne,
  countDocuments: usersCountDocuments,
  updateOne: usersUpdateOne,
};
const mockTeams = { findOne: teamsFindOne };

// Alias for userExistsLogic with a concrete return type
const mockUserExists = userExistsLogic as jest.MockedFunction<(...args: unknown[]) => Promise<UserExistsResp>>;

// Helpers to build docs
const aTeam = (overrides: Partial<TeamDocument> = {}): TeamDocument => ({
  team_id: 'team123',
  leader_email: 'leader@example.com',
  members: [],
  status: 'Active',
  team_name: 'Team X',
  created: new Date(),
  updated: new Date(),
  ...overrides,
});

const aUser = (overrides: Partial<UserDocument> = {}): UserDocument =>
  ({
    first_name: 'First',
    last_name: 'Last',
    email: 'user@example.com',
    email_verified: true,
    password: 'x',
    role: {
      hacker: true,
      volunteer: false,
      judge: false,
      sponsor: false,
      mentor: false,
      organizer: false,
      director: false,
    },
    votes: 0,
    github: '',
    major: '',
    short_answer: '',
    shirt_size: '',
    dietary_restrictions: '',
    special_needs: '',
    date_of_birth: '',
    school: '',
    grad_year: '',
    gender: '',
    level_of_study: '',
    ethnicity: '',
    phone_number: '',
    registration_status: 'registered',
    day_of: { event: {} },
    discord: {
      user_id: '',
      username: '',
      access_token: '',
      refresh_token: '',
      expires_at: 0,
    },
    confirmed_team: false,
    team_info: { team_id: null, role: null, pending_invites: [] },
    created_at: '',
    registered_at: '',
    ...overrides,
  }) as UserDocument;

describe('POST /teams/invite handler', () => {
  const path = '/teams/invite';
  const method = 'POST';
  const baseBody = {
    auth_token: 'tok',
    auth_email: 'leader@example.com',
    team_id: 'team123',
    emails: ['alice@example.com', 'bob@example.com'],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (validateToken as jest.Mock).mockReturnValue(true);

    // Session + client wiring
    sessionWithTransaction.mockImplementation(async (fn: (s?: unknown) => unknown) => fn());
    sessionEndSession.mockImplementation(() => undefined);
    clientStartSession.mockReturnValue({ withTransaction: sessionWithTransaction, endSession: sessionEndSession });

    // DB wiring
    dbConnect.mockResolvedValue();
    dbGetClient.mockReturnValue({ startSession: clientStartSession } as unknown as ReturnType<
      typeof clientStartSession
    >);
    dbGetCollection.mockImplementation((name: string) => (name === 'users' ? mockUsers : mockTeams));
    (MongoDB.getInstance as jest.Mock).mockReturnValue({
      connect: dbConnect,
      getClient: dbGetClient,
      getCollection: dbGetCollection,
    } as unknown);

    // Reset standalone mocks
    usersFindOne.mockReset();
    usersCountDocuments.mockReset();
    usersUpdateOne.mockReset();
    teamsFindOne.mockReset();
    mockUserExists.mockReset();
  });

  it('returns 401 if token invalid', async () => {
    (validateToken as jest.Mock).mockReturnValue(false);

    const ev = createEvent(baseBody, path, method);
    const res = await main(ev, mockContext, jest.fn());

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body)).toEqual({ message: 'Unauthorized' });
  });

  it('returns 404 if auth user not found', async () => {
    usersFindOne.mockResolvedValueOnce(null); // auth user
    const ev = createEvent(baseBody, path, method);
    const res = await main(ev, mockContext, jest.fn());

    expect(usersFindOne).toHaveBeenCalledWith({ email: 'leader@example.com' });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body)).toEqual({ message: 'Auth user not found' });
  });

  it('returns 404 if team not found', async () => {
    usersFindOne.mockResolvedValueOnce(aUser({ email: 'leader@example.com' })); // auth user
    teamsFindOne.mockResolvedValueOnce(null); // team

    const ev = createEvent(baseBody, path, method);
    const res = await main(ev, mockContext, jest.fn());

    expect(teamsFindOne).toHaveBeenCalledWith({ team_id: 'team123' });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body)).toEqual({ message: 'Team not found' });
  });

  it('returns 403 if caller is not leader', async () => {
    usersFindOne.mockResolvedValueOnce(aUser({ email: 'leader@example.com' })); // auth user
    teamsFindOne.mockResolvedValueOnce(aTeam({ leader_email: 'other@example.com' }));

    const ev = createEvent(baseBody, path, method);
    const res = await main(ev, mockContext, jest.fn());

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body)).toEqual({ message: 'Auth user is not the team leader' });
  });

  it('returns 400 if no slots available', async () => {
    usersFindOne.mockResolvedValueOnce(aUser({ email: 'leader@example.com' })); // auth user
    teamsFindOne.mockResolvedValueOnce(aTeam({ members: ['a', 'b', 'c', 'd'] })); // 4 + leader -> full
    usersCountDocuments.mockResolvedValueOnce(0);

    const ev = createEvent(baseBody, path, method);
    const res = await main(ev, mockContext, jest.fn());

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body)).toEqual({ message: 'Team is already full' });
  });

  it('processes invites: alice success, bob fails userExists', async () => {
    // Auth user + team
    usersFindOne
      .mockResolvedValueOnce(aUser({ email: 'leader@example.com' })) // auth user
      .mockResolvedValueOnce(
        aUser({
          email: 'alice@example.com',
          confirmed_team: false,
          team_info: { team_id: null, role: null, pending_invites: [] },
        })
      ); // alice user inside txn

    teamsFindOne.mockResolvedValueOnce(aTeam({ members: [] }));
    usersCountDocuments.mockResolvedValueOnce(0);

    mockUserExists
      .mockResolvedValueOnce({ statusCode: 200, body: '"User exists"' }) // alice ok
      .mockResolvedValueOnce({ statusCode: 404, body: '{}' }); // bob fails

    usersUpdateOne.mockResolvedValueOnce({ modifiedCount: 1 });

    const ev = createEvent(baseBody, path, method);
    const res = await main(ev, mockContext, jest.fn());

    const body = JSON.parse(res.body);
    expect(res.statusCode).toBe(200);
    expect(body).toEqual({
      message: 'Invitations sent successfully',
      invited: ['alice@example.com'],
      failed: [{ email: 'bob@example.com', reason: 'User does not exist or unauthorized' }],
    });

    expect(usersUpdateOne).toHaveBeenCalledWith(
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
    usersFindOne.mockResolvedValueOnce(aUser({ email: 'leader@example.com' })); // auth user
    teamsFindOne.mockResolvedValueOnce(aTeam({ members: [] }));
    usersCountDocuments.mockResolvedValueOnce(0);

    // Force transaction error by overriding the session
    clientStartSession.mockReturnValueOnce({
      withTransaction: jest.fn(async () => {
        throw new Error('Txn failed');
      }),
      endSession: jest.fn(),
    });

    const ev = createEvent(baseBody, path, method);
    const res = await main(ev, mockContext, jest.fn());

    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body)).toEqual({
      message: 'Internal server error during invitation processing',
    });
  });
});
