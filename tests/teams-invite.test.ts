// tests/teams-invite.handler.test.ts
import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { main } from '../src/functions/teams/invite/handler';
import { createEvent, mockContext } from './helper';
import { teamInviteLogic } from '../src/util';

// tell Jest to replace the util module with a mock that exports teamInviteLogic
jest.mock('../src/util', () => ({
  teamInviteLogic: jest.fn(),
}));

interface TeamInviteResp {
  statusCode: number;
  body: string;
}

const mockTeamInvite = teamInviteLogic as unknown as jest.MockedFunction<
  (authEmail: string, authToken: string, teamId: string, emails: string[]) => Promise<TeamInviteResp>
>;

describe('POST /teams/invite handler (thin)', () => {
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
    mockTeamInvite.mockReset();
  });

  it('returns 401 if token invalid', async () => {
    mockTeamInvite.mockResolvedValueOnce({
      statusCode: 401,
      body: JSON.stringify({ message: 'Unauthorized' }),
    });

    const ev = createEvent(baseBody, path, method);
    const res = await main(ev, mockContext, jest.fn());

    expect(mockTeamInvite).toHaveBeenCalledWith('leader@example.com', 'tok', 'team123', [
      'alice@example.com',
      'bob@example.com',
    ]);
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body)).toEqual({ message: 'Unauthorized' });
  });

  it('returns 404 if auth user not found', async () => {
    mockTeamInvite.mockResolvedValueOnce({
      statusCode: 404,
      body: JSON.stringify({ message: 'Auth user not found' }),
    });

    const ev = createEvent(baseBody, path, method);
    const res = await main(ev, mockContext, jest.fn());

    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body)).toEqual({ message: 'Auth user not found' });
  });

  it('returns 404 if team not found', async () => {
    mockTeamInvite.mockResolvedValueOnce({
      statusCode: 404,
      body: JSON.stringify({ message: 'Team not found' }),
    });

    const ev = createEvent(baseBody, path, method);
    const res = await main(ev, mockContext, jest.fn());

    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body)).toEqual({ message: 'Team not found' });
  });

  it('returns 403 if caller is not leader', async () => {
    mockTeamInvite.mockResolvedValueOnce({
      statusCode: 403,
      body: JSON.stringify({ message: 'Auth user is not the team leader' }),
    });

    const ev = createEvent(baseBody, path, method);
    const res = await main(ev, mockContext, jest.fn());

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body)).toEqual({ message: 'Auth user is not the team leader' });
  });

  it('returns 400 if no slots available', async () => {
    mockTeamInvite.mockResolvedValueOnce({
      statusCode: 400,
      body: JSON.stringify({ message: 'Team is already full' }),
    });

    const ev = createEvent(baseBody, path, method);
    const res = await main(ev, mockContext, jest.fn());

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body)).toEqual({ message: 'Team is already full' });
  });

  it('processes invites: alice success, bob fails userExists', async () => {
    mockTeamInvite.mockResolvedValueOnce({
      statusCode: 200,
      body: JSON.stringify({
        message: 'Invitations sent successfully',
        invited: ['alice@example.com'],
        failed: [{ email: 'bob@example.com', reason: 'User does not exist or unauthorized' }],
      }),
    });

    const ev = createEvent(baseBody, path, method);
    const res = await main(ev, mockContext, jest.fn());

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({
      message: 'Invitations sent successfully',
      invited: ['alice@example.com'],
      failed: [{ email: 'bob@example.com', reason: 'User does not exist or unauthorized' }],
    });
  });

  it('rolls back and returns 500 if transaction throws', async () => {
    mockTeamInvite.mockResolvedValueOnce({
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal server error during invitation processing' }),
    });

    const ev = createEvent(baseBody, path, method);
    const res = await main(ev, mockContext, jest.fn());

    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body)).toEqual({
      message: 'Internal server error during invitation processing',
    });
  });
});
