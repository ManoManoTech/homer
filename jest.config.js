const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(process.cwd(), '.env.test') });

module.exports = {
  collectCoverageFrom: [
    'src/**',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**/*.test.ts',
    /** Exclude logger module from coverage  since it is mocked in setupAfterEnv.ts*/
    '!src/**/services/logger.ts',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@root/(.*)$': '<rootDir>/$1',
  },
  resetMocks: true,
  setupFilesAfterEnv: ['./config/jest/setupAfterEnv.ts'],
  testMatch: ['<rootDir>/**/__tests__/**/*.test.ts'],
  transform: {
    '\\.tsx?$': 'ts-jest',
  },
};
