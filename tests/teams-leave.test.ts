import { main } from '../src/functions/teams/leave/handler';
import { validateToken, MongoDB, teamsDisband} from '../src/util';
import { createEvent, mockContext } from './helper';

jest.mock('../src/util');

describe('teamLeave Lambda',()=>{
    const path = '/teams/leave';
    const httpMethod = 'POST';
    let mockUsers: any;
    let mockTeams: any;
    
    beforeEach(()=>{

        //mock validToken
        (validateToken as jest.Mock).mockReturnValue(true);

        (teamsDisband as unknown as jest.Mock) = jest.fn();

        (teamsDisband as jest.Mock).mockResolvedValue({
            statusCode: 200,
            body: JSON.stringify({ statusCode: 200, message: "Mocked up function" }),
        });
        

        //mock user info
        mockUsers = 
        {
            findOne: jest.fn(),
            updateOne: jest.fn()
        }

        mockTeams = {
            findOne: jest.fn(),
            updateOne: jest.fn()
          };

        // Mock MongoDB.getInstance and collection access
        (MongoDB.getInstance as jest.Mock).mockReturnValue({
        connect: jest.fn(),
        getCollection: (name: string) => {
          if (name === 'users') return mockUsers;
          if (name === 'teams') return mockTeams;
        }
        });

    });

    // 1. check for invalid volidToken
    it('returns 401 if token is invalid', async () => {
        const userData = {
          auth_token: 'token',
          auth_email: 'user@example.com',
          team_id: 'team123',
        };
      
        const mockEvent = createEvent(userData, path, httpMethod);
        const mockCallback = jest.fn();
      
        (validateToken as jest.Mock).mockReturnValue(false);
      
        const result = await main(mockEvent, mockContext, mockCallback);
      
        expect(result.statusCode).toBe(401);
        expect(JSON.parse(result.body).message).toBe('Unauthorized');
    });


    // 3. Disbanded team
    it('return 400 disbanded team', async() => {
        const userData = {
            auth_token: 'token',
            auth_email: 'leader@gmail.com',
            team_id: 'team123',
        };

        const mockEvent = createEvent(userData, path, httpMethod);
        const mockCallback = jest.fn();

        mockUsers.findOne.mockResolvedValue(
        {
            confirmed_team: false,
            team_info:{
                team_id: "team1234",
                role: "leader",
                pending_invites: [{},{}]
            }
        }
        );
        mockTeams.findOne.mockResolvedValue(
        {
            team_id: "team1234",
            leader_email: "leader@gmail.com",
            members: [],
            status: "Disbanded",
            created: "dateCreated",
            updated: "dateUpdated"
        }
        )
        const result = await main(mockEvent, mockContext, mockCallback)
        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body).message).toBe("Team already disbanded"); 
    })

    //empty team
    it('return 400 empty team', async() => {
        const userData = {
            auth_token: 'token',
            auth_email: 'leader@gmail.com',
            team_id: 'team123',
        };

        const mockEvent = createEvent(userData, path, httpMethod);
        const mockCallback = jest.fn();

        mockUsers.findOne.mockResolvedValue(
        {
            confirmed_team: false,
            team_info:{
                team_id: "team1234",
                role: "leader",
                pending_invites: [{},{}]
            }
        }
        );
        mockTeams.findOne.mockResolvedValue(
        {
            team_id: "team1234",
            leader_email: "leader@gmail.com",
            members: [],
            status: "Active",
            created: "dateCreated",
            updated: "dateUpdated"
        }
        )
        const result = await main(mockEvent, mockContext, mockCallback)
        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body).message).toBe('Empty team member list'); 
    })

    // not in the team
    it('return 400 user not in team', async() => {
        const userData = {
            auth_token: 'token',
            auth_email: 'leader@gmail.com',
            team_id: 'team123',
        };

        const mockEvent = createEvent(userData, path, httpMethod);
        const mockCallback = jest.fn();

        mockUsers.findOne.mockResolvedValue(
        {
            confirmed_team: false,
            team_info:{
                team_id: "team1234",
                role: "leader",
                pending_invites: [{},{}]
            }
        }
        );
        mockTeams.findOne.mockResolvedValue(
        {
            team_id: "team1234",
            leader_email: "leader@gmail.com",
            members: ["member1@gmail.com, member2@gmail.com"],
            status: "Active",
            created: "dateCreated",
            updated: "dateUpdated"
        }
        )
        const result = await main(mockEvent, mockContext, mockCallback)
        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body).message).toBe('User not in team'); 
    })


    // team leader leaves
    it('return 200 team lead leaves', async() => {
        const userData = {
            auth_token: 'token',
            auth_email: 'leader@gmail.com',
            team_id: 'team123',
        };

        const mockEvent = createEvent(userData, path, httpMethod);
        const mockCallback = jest.fn();

        mockUsers.findOne.mockResolvedValue(
        {
            confirmed_team: false,
            team_info:{
                team_id: "team1234",
                role: "leader",
                pending_invites: [{},{}]
            }
        }
        );
        mockTeams.findOne.mockResolvedValue(
        {
            team_id: "team1234",
            leader_email: "leader@gmail.com",
            members: ["leader@gmail.com"],
            status: "Active",
            created: "dateCreated",
            updated: "dateUpdated"
        }
        )
        const result = await main(mockEvent, mockContext, mockCallback)
        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body).message).toBe("Mocked up function"); 
    })

})
