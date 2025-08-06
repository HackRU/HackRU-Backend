import { main } from '../src/functions/teams-decline-invite/handler';
import { createEvent, mockContext } from './helper';
import * as util from '../src/util';

jest.mock('../src/util', () => ({
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
  validateToken: jest.fn(),
}));

describe('Decline Team Invite endpoint', () => {
  const path = '/teams-decline-invite';
  const httpMethod = 'POST';
  const mockCallback = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
  });

  it('returns 401 for invalid auth token', async () => {
    const userData = { auth_email: 'test@example.com', auth_token: 'invalidToken', team_id: 'team123' };
    const event = createEvent(userData, path, httpMethod);
    (util.validateToken as jest.Mock).mockReturnValue(false);

    const res = await main(event, mockContext, mockCallback);

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).message).toBe('Unauthorized');
  });

  it('returns 404 if user is not found', async () => {
    const userData = { auth_email: 'notfound@example.com', auth_token: 'validToken', team_id: 'team123' };
    const event = createEvent(userData, path, httpMethod);
    (util.validateToken as jest.Mock).mockReturnValue(true);
    const findOne = util.MongoDB.getInstance('uri').getCollection('users').findOne as jest.Mock;
    findOne.mockResolvedValue(null);

    const res = await main(event, mockContext, mockCallback);

    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).message).toBe('User not found.');
  });

  it('returns 400 if invite does not exist', async () => {
    const userData = { auth_email: 'test@example.com', auth_token: 'validToken', team_id: 'team123' };
    const event = createEvent(userData, path, httpMethod);
    (util.validateToken as jest.Mock).mockReturnValue(true);
    const findOne = util.MongoDB.getInstance('uri').getCollection('users').findOne as jest.Mock;
    findOne.mockResolvedValue({ email: 'test@example.com', team_info: { pending_invites: [] } });

    const res = await main(event, mockContext, mockCallback);

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).message).toBe('No pending invitation found for this team');
  });

  it('declines invite and returns 200', async () => {
    const userData = { auth_email: 'test@example.com', auth_token: 'validToken', team_id: 'team123' };
    const event = createEvent(userData, path, httpMethod);
    (util.validateToken as jest.Mock).mockReturnValue(true);
    const collection = util.MongoDB.getInstance('uri').getCollection('users');
    const findOne = collection.findOne as jest.Mock;
    const updateOne = collection.updateOne as jest.Mock;
    findOne.mockResolvedValue({ email: 'test@example.com', team_info: { pending_invites: [{ team_id: 'team123' }] } });
    updateOne.mockResolvedValue({ modifiedCount: 1 });

    const res = await main(event, mockContext, mockCallback);

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).message).toBe('Team invitation declined successfully');
    expect(updateOne).toHaveBeenCalledWith(
      { email: 'test@example.com' },
      { $set: { 'team_info.pending_invites': [] } }
    );
  });

  it('returns 500 on internal server error', async () => {
    const userData = { auth_email: 'test@example.com', auth_token: 'validToken', team_id: 'team123' };
    const event = createEvent(userData, path, httpMethod);
    (util.validateToken as jest.Mock).mockReturnValue(true);
    const findOne = util.MongoDB.getInstance('uri').getCollection('users').findOne as jest.Mock;
    findOne.mockRejectedValue(new Error('DB error'));

    const res = await main(event, mockContext, mockCallback);

    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body).message).toBe('Internal Server Error');
  });
});

