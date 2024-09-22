import { main } from '../src/functions/leaderboard/handler';
import { createEvent, mockContext } from './helper';

jest.mock('../src/util', () => ({
  MongoDB: {
    getInstance: jest.fn().mockReturnValue({
      connect: jest.fn(),
      disconnect: jest.fn(),
      getCollection: jest.fn().mockReturnValue({
        aggregate: jest.fn().mockReturnValue({
          toArray: jest.fn().mockReturnValue([
            { name: 'Player1', total_points: 150 },
            { name: 'Player2', total_points: 130 },
            { name: 'Player3', total_points: 120 },
            { name: 'Player4', total_points: 110 },
            { name: 'Player5', total_points: 110 },
          ]),
        }),
      }),
    }),
  },
}));
describe('/leaderboard endpoint', () => {
  const mockCallback = jest.fn();
  const mockEvent = createEvent({}, '/leaderboard', 'GET');
  it('Successfully find top 20', async () => {
    const res = await main(mockEvent, mockContext, mockCallback);
    expect(res.statusCode).toEqual(200);
    expect(JSON.parse(res.body)).toEqual([
      { name: 'Player1', total_points: 150 },
      { name: 'Player2', total_points: 130 },
      { name: 'Player3', total_points: 120 },
      { name: 'Player4', total_points: 110 },
      { name: 'Player5', total_points: 110 },
    ]);
  });
});
