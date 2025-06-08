import { main } from '../src/functions/interest-form/handler';
import { createEvent, mockContext } from './helper';

// Mock the MongoDB utility
jest.mock('../src/util', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention
  MongoDB: {
    getInstance: jest.fn().mockReturnValue({
      connect: jest.fn(),
      disconnect: jest.fn(),
      getCollection: jest.fn().mockReturnValue({
        insertOne: jest.fn(),
      }),
    }),
  },
}));

// Mock environment variables
jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

jest.mock('path', () => ({
  resolve: jest.fn().mockReturnValue('.env'),
}));

import * as util from '../src/util';

describe('Submit Interest Form tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.MONGO_URI = 'mongodb://test-uri';
  });

  const validFormData = {
    firstName: 'John',
    lastName: 'Doe',
    age: 20,
    phoneNumber: '+1234567890',
    email: 'john.doe@test.org',
    school: 'Test University',
    levelOfStudy: 'Undergraduate',
    countryOfResidence: 'United States',
    linkedInUrl: 'https://linkedin.com/in/johndoe',
    mlh_code_of_conduct: true,
    mlh_privacy_policy: true,
    mlh_terms_and_conditions: true,
  };

  const path = 'interest-form';
  const httpMethod = 'POST';

  // Mock references for easier testing
  const connectMock = util.MongoDB.getInstance('uri').connect as jest.Mock;
  const getCollectionMock = util.MongoDB.getInstance('uri').getCollection as jest.Mock;
  const insertOneMock = util.MongoDB.getInstance('uri').getCollection('interest-forms').insertOne as jest.Mock;
  const mockCallback = jest.fn();

  it('successfully submits interest form', async () => {
    const mockInsertResult = {
      insertedId: 'mock-object-id-123',
    };

    insertOneMock.mockResolvedValue(mockInsertResult);

    const mockEvent = createEvent(validFormData, path, httpMethod);
    const result = await main(mockEvent, mockContext, mockCallback);

    expect(connectMock).toHaveBeenCalled();
    expect(getCollectionMock).toHaveBeenCalledWith('interest-forms');
    expect(insertOneMock).toHaveBeenCalledWith(validFormData);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).message).toBe('Successful Form Submission');
    expect(JSON.parse(result.body).submissionId).toBe('mock-object-id-123');
  });

  it('successfully submits form with different valid data', async () => {
    const differentValidData = {
      firstName: 'Jane',
      lastName: 'Smith',
      age: 22,
      phoneNumber: '+9876543210',
      email: 'jane.smith@university.edu',
      school: 'Different University',
      levelOfStudy: 'Graduate',
      countryOfResidence: 'Canada',
      linkedInUrl: 'https://linkedin.com/in/janesmith',
      mlh_code_of_conduct: true,
      mlh_privacy_policy: true,
      mlh_terms_and_conditions: false,
    };

    const mockInsertResult = {
      insertedId: 'mock-object-id-456',
    };

    insertOneMock.mockResolvedValue(mockInsertResult);

    const mockEvent = createEvent(differentValidData, path, httpMethod);
    const result = await main(mockEvent, mockContext, mockCallback);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).message).toBe('Successful Form Submission');
    expect(insertOneMock).toHaveBeenCalledWith(differentValidData);
  });

  it('successfully submits form with minimal required fields', async () => {
    const minimalFormData = {
      firstName: 'Bob',
      lastName: 'Johnson',
      age: 19,
      phoneNumber: '+1555123456',
      email: 'bob.johnson@college.edu',
      school: 'Community College',
      levelOfStudy: 'Undergraduate',
      countryOfResidence: 'United States',
      linkedInUrl: '', // Optional field - empty string
      mlh_code_of_conduct: true,
      mlh_privacy_policy: true,
      mlh_terms_and_conditions: true,
    };

    const mockInsertResult = {
      insertedId: 'mock-object-id-minimal',
    };

    insertOneMock.mockResolvedValue(mockInsertResult);

    const mockEvent = createEvent(minimalFormData, path, httpMethod);
    const result = await main(mockEvent, mockContext, mockCallback);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).message).toBe('Successful Form Submission');
    expect(insertOneMock).toHaveBeenCalledWith(minimalFormData);
  });

  it('handles invalid data causing runtime error', async () => {
    // Simulate invalid data that somehow bypasses schema validation
    const invalidFormData = {
      firstName: 'Test',
      lastName: 'Test',
      age: 20,
      phoneNumber: '+1234567890',
      email: 'test@test.org',
      school: 'Test School',
      levelOfStudy: 'Undergraduate',
      countryOfResidence: 'Test Country',
      linkedInUrl: 'https://linkedin.com/in/HelloWorld',
      mlh_code_of_conduct: 'HI', // Invalid boolean value
      mlh_privacy_policy: true,
      mlh_terms_and_conditions: true,
    };

    // Mock insertOne to throw an error due to invalid data
    insertOneMock.mockRejectedValue(new Error('Invalid data format'));

    const mockEvent = createEvent(invalidFormData, path, httpMethod);
    const result = await main(mockEvent, mockContext, mockCallback);

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body).message).toBe('Internal Server Error');
    expect(JSON.parse(result.body).error).toBe('Invalid data format');
  });
  it('successfully submits form with valid LinkedIn URL', async () => {
    const mockInsertResult = {
      insertedId: 'mock-object-id-123',
    };

    insertOneMock.mockResolvedValue(mockInsertResult);

    const mockEvent = createEvent(validFormData, path, httpMethod);
    const result = await main(mockEvent, mockContext, mockCallback);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).message).toBe('Successful Form Submission');
    expect(insertOneMock).toHaveBeenCalledWith(validFormData);
  });
});
