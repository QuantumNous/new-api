const jestDefaultConfig = {
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  rootDir: '.',
  roots: ['<rootDir>/src'],
  transformIgnorePatterns: ['[/\\\\]node_modules[/\\\\].+\\.(js|jsx)$'],
};

const web = {
  ...jestDefaultConfig,
  displayName: {
    name: 'Web',
    color: 'cyan',
  },
  testMatch: ['**/__tests__/**/*.(spec|test).ts?(x)'],
  transform: {
    '^.+\\.tsx?$': '@swc/jest',
    '^.+\\.(css|scss|sass)$': 'jest-preview/transforms/css',
    '^(?!.*\\.(js|jsx|mjs|cjs|ts|tsx|css|json)$)':
      'jest-preview/transforms/file',
  },
  setupFilesAfterEnv: ['<rootDir>/scripts/jest/setup.ts'],
  testEnvironment: 'jest-fixed-jsdom',
  testEnvironmentOptions: {
    customExportConditions: [''],
  },
};

const server = {
  ...jestDefaultConfig,
  displayName: {
    name: 'Server',
    color: 'blue',
  },
  testMatch: ['**/+([a-zA-Z]).server.(spec|test).ts?(x)'],
  transform: {
    '^.+\\.tsx?$': '@swc/jest',
  },
  testEnvironment: 'node',
};

const getProjects = () => {
  const testEnv = process.env.TEST_ENV;
  if (!testEnv) {
    return [web, server];
  }

  switch (testEnv) {
    case 'web':
      return [web];
    case 'server':
      return [server];
  }
};

module.exports = {
  collectCoverageFrom: [
    '**/**/*.{ts,tsx}',
    '!**/**/*.test.{ts,tsx}',
    '!**/src/types/**',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/__tests__/**',
  ],
  projects: getProjects(),
};
