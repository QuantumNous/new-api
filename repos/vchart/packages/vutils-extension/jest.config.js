// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path');

module.exports = {
  preset: 'ts-jest',
  runner: 'jest-electron/runner',
  testEnvironment: 'jest-electron/environment',
  testRegex: '/__tests__/.*\\.test\\.(js|ts)$',
  silent: true,
  globals: {
    'ts-jest': {
      resolveJsonModule: true,
      esModuleInterop: true,
      experimentalDecorators: true,
      module: 'ESNext',
      tsconfig: './tsconfig.test.json'
    }
  },
  verbose: true,
  collectCoverage: true,
  coverageReporters: ['json-summary', 'lcov', 'text'],
  coveragePathIgnorePatterns: ['node_modules', '__tests__', 'interface.ts', '.d.ts', 'typings'],
  collectCoverageFrom: [
    '**/src/**',
    '!**/cjs/**',
    '!**/dist/**',
    '!**/es/**',
    '!**/node_modules/**',
    '!**/__tests__/**',
    '!**/types/**',
    '!**/interface.ts'
  ]
  // moduleNameMapper: {
  //   'd3-color': path.resolve(__dirname, './node_modules/d3-color/dist/d3-color.min.js'),
  //   'd3-array': path.resolve(process.cwd(), './node_modules/d3-array/dist/d3-array.min.js'),
  //   'd3-geo': path.resolve(__dirname, './node_modules/d3-geo/dist/d3-geo.min.js'),
  //   'd3-dsv': path.resolve(__dirname, './node_modules/d3-dsv/dist/d3-dsv.min.js'),
  //   'd3-hexbin': path.resolve(__dirname, './node_modules/d3-hexbin/build/d3-hexbin.min.js'),
  //   'd3-hierarchy': path.resolve(__dirname, './node_modules/d3-hierarchy/dist/d3-hierarchy.min.js')
  // },
  // setupFiles: ['./setup-mock.js']
};
