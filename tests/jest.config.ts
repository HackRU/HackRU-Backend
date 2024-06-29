import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  preset: 'ts-jest', // Use ts-jest preset for TypeScript
  testEnvironment: 'node', // Test environment is Node.js
  testMatch: ['**/*.test.ts'], // Match test files with .test.ts extension
  transform: {
    '^.+\\.ts?$': 'ts-jest',
  },
  rootDir: '../',
  moduleNameMapper: {
    '^@functions/(.*)$': '<rootDir>/src/functions/$1',
    '^@libs/(.*)$': '<rootDir>/src/libs/$1',
  },
};

export default config;
