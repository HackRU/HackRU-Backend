import { afterEach, describe, expect, it } from "@jest/globals"


import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
import { main } from './handler';

const bcrypt = require('bcryptjs');
jest.mock('bcryptjs');

//const MongoDB = require('../../util');
jest.mock('../../util', () => ({
    MongoDB: {
        getInstance: jest.fn().mockReturnValue({
            connect: jest.fn(),
            disconnect: jest.fn(),
            getCollection: jest.fn().mockReturnValue({
                findOne: jest.fn(),
                insertOne: jest.fn(),
        })  
        
})
}}));

afterEach(()=>{
    jest.resetAllMocks();
})


describe("Create endpoint", () => {
    it('Create a new user', async() =>{

        const mockEvent = {
            body: JSON.stringify({
                email: 'testEmail@gmail.com',
                password: 'testPassword123',
            }),
            headers: {},
            multiValueHeaders: {},
            httpMethod: 'POST',
            isBase64Encoded: false,
            path: '',
            pathParameters: null,
            queryStringParameters: null,
            multiValueQueryStringParameters: null,
            stageVariables: null,
            requestContext: {} as any,
            resource: '',
            rawBody: JSON.stringify({
                email: 'testEmail@gmail.com',
                password: 'testPassword123',
            }),
        };

        const mockContext = {
            callbackWaitsForEmptyEventLoop: false,
            functionName: 'mockFunctionName',
            functionVersion: 'mockFunctionVersion',
            invokedFunctionArn: 'mockInvokedFunctionArn',
            awsRequestId: 'mockRequestId',
            logGroupName: 'mockLogGroupName',
            logStreamName: 'mockLogStreamName',
            memoryLimitInMB: '128',
            invokeid: 'mockInvokeId',
            getRemainingTimeInMillis: () => 1000,
            done: jest.fn(),
            fail: jest.fn(),
            succeed: jest.fn(),
        };

        const mockCallback = jest.fn();

        bcrypt.hash.mockResolvedValue('hashedPassword');
        const res = await main(mockEvent, mockContext, mockCallback);
        
        expect(res.statusCode).toBe(200);
        expect(res.body).toBe('User created!');

    })
    /*it('Duplicate User', async() =>{
        
        const mockEvent = {
            body: JSON.stringify({
                email: 'testEmail@gmail.com',
                password: 'testPassword123',
            }),
            headers: {},
            multiValueHeaders: {},
            httpMethod: 'POST',
            isBase64Encoded: false,
            path: '',
            pathParameters: null,
            queryStringParameters: null,
            multiValueQueryStringParameters: null,
            stageVariables: null,
            requestContext: {} as any,
            resource: '',
            rawBody: JSON.stringify({
                email: 'testEmail@gmail.com',
                password: 'testPassword123',
            }),
        };

        const mockContext = {
            callbackWaitsForEmptyEventLoop: false,
            functionName: 'mockFunctionName',
            functionVersion: 'mockFunctionVersion',
            invokedFunctionArn: 'mockInvokedFunctionArn',
            awsRequestId: 'mockRequestId',
            logGroupName: 'mockLogGroupName',
            logStreamName: 'mockLogStreamName',
            memoryLimitInMB: '128',
            invokeid: 'mockInvokeId',
            getRemainingTimeInMillis: () => 1000,
            done: jest.fn(),
            fail: jest.fn(),
            succeed: jest.fn(),
        };
        const mockCallback = jest.fn();

        bcrypt.hash.mockResolvedValue('hashedPassword');
        MongoDB.getInstance.getCollection().mockReturnValue({
            findOne: () => Promise.resolve({ email: 'testEmail@gmail.com' }),
            insertOne: () => Promise.resolve("null")
        });
        const res = await main(mockEvent, mockContext, mockCallback);
        expect(res.statusCode).toBe(400);
        expect(res.body).toBe('Duplicate user!');


    })*/
})
