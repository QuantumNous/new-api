// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path');

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getNodeModulePackageJson(packageName) {
  return path.resolve(__dirname, 'node_modules', ...packageName.split('/'), 'package.json');
}

function mapPackageExportsToCjs(packageName) {
  const packageJsonPath = getNodeModulePackageJson(packageName);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const packageJson = require(packageJsonPath);
  const packageRoot = path.dirname(packageJsonPath);

  return Object.entries(packageJson.exports ?? {}).reduce((mappers, [subpath, target]) => {
    if (subpath === '.' || !target || typeof target !== 'object' || !target.require) {
      return mappers;
    }

    const exportPath = subpath.slice(2);
    mappers[`^${escapeRegex(packageName)}\\/${escapeRegex(exportPath)}$`] = path.resolve(
      packageRoot,
      target.require.replace(/\.js$/, '')
    );

    return mappers;
  }, {});
}

const vrenderPackageExportMappers = {
  ...mapPackageExportsToCjs('@visactor/vrender'),
  ...mapPackageExportsToCjs('@visactor/vrender-core'),
  ...mapPackageExportsToCjs('@visactor/vrender-animate'),
  ...mapPackageExportsToCjs('@visactor/vrender-components'),
  ...mapPackageExportsToCjs('@visactor/vrender-kits')
};

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
  // collectCoverage: true,
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
  ],
  moduleNameMapper: {
    'd3-color': path.resolve(__dirname, './node_modules/d3-color/dist/d3-color.min.js'),
    'd3-array': path.resolve(process.cwd(), './node_modules/d3-array/dist/d3-array.min.js'),
    'd3-geo': path.resolve(__dirname, './node_modules/d3-geo/dist/d3-geo.min.js'),
    'd3-dsv': path.resolve(__dirname, './node_modules/d3-dsv/dist/d3-dsv.min.js'),
    'd3-hexbin': path.resolve(__dirname, './node_modules/d3-hexbin/build/d3-hexbin.min.js'),
    'd3-hierarchy': path.resolve(__dirname, './node_modules/d3-hierarchy/dist/d3-hierarchy.min.js'),
    '^@visactor/vrender$': path.resolve(__dirname, './node_modules/@visactor/vrender/cjs/index'),
    '^@visactor/vrender-core$': path.resolve(__dirname, './node_modules/@visactor/vrender-core/cjs/index'),
    '^@visactor/vrender-animate$': path.resolve(__dirname, './node_modules/@visactor/vrender-animate/cjs/index'),
    '^@visactor/vrender-components$': path.resolve(__dirname, './node_modules/@visactor/vrender-components/cjs/index'),
    '^@visactor/vrender-kits$': path.resolve(__dirname, './node_modules/@visactor/vrender-kits/cjs/index-node'),
    ...vrenderPackageExportMappers,
    '^@visactor/vrender/(.*)$': path.resolve(__dirname, './node_modules/@visactor/vrender/cjs/$1'),
    '^@visactor/vrender-core/(.*)$': path.resolve(__dirname, './node_modules/@visactor/vrender-core/cjs/$1'),
    '^@visactor/vrender-animate/(.*)$': path.resolve(__dirname, './node_modules/@visactor/vrender-animate/cjs/$1'),
    '^@visactor/vrender-components/(.*)$': path.resolve(
      __dirname,
      './node_modules/@visactor/vrender-components/cjs/$1'
    ),
    '^@visactor/vrender-kits/(.*)$': path.resolve(__dirname, './node_modules/@visactor/vrender-kits/cjs/$1'),
    '^@visactor/vchart$': path.resolve(__dirname, './src/index.ts'),
    '@visactor/vutils-extension': path.resolve(__dirname, '../vutils-extension/src/index.ts')
  },
  setupFiles: ['./setup-mock.js']
};
