import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  preset: 'ts-jest', // Use ts-jest preset for TypeScript
  testEnvironment: 'node', // Test environment is Node.js
  testMatch: ['**/*.test.ts'], // Match test files with .test.ts extension
  transform: {
    // tsconfig.json targets Node16 modules for the deployed bundle, which forbids requiring the
    // ESM-only @middy packages. The tests run as CommonJS, so compile them with classic resolution.
    // eslint-disable-next-line @typescript-eslint/naming-convention
    '^.+\\.ts?$': ['ts-jest', { tsconfig: { module: 'commonjs', moduleResolution: 'node' } }],
  },
  rootDir: '../',
  moduleNameMapper: {
    '^@functions/(.*)$': '<rootDir>/src/functions/$1',
    '^@libs/(.*)$': '<rootDir>/src/libs/$1',
  },
};

export default config;
