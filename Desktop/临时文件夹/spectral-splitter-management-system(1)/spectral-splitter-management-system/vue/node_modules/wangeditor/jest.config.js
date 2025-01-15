module.exports = {
    roots: ['<rootDir>/test'],
    testRegex: 'test/(.+)\\.test\\.(js?|ts?)$',
    transform: {
        '^.+\\.(css|less)$': '<rootDir>/test/helpers/styleMock.js',
        '^.+\\.ts?$': 'ts-jest',
    },
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/unit/$1',
    },
    collectCoverageFrom: ['src/**/*.ts', 'src/**/*.js'],
    setupFilesAfterEnv: ['./test/setup/index.ts']
}

