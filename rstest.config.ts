import { defineConfig } from '@rstest/core';
import { withRslibConfig } from '@rstest/adapter-rslib';

// Disable color in test
process.env.NO_COLOR = '1';

// TODO: change to test projects ['packages/*']
export default defineConfig({
  extends: withRslibConfig({
    configPath: './packages/core/rslib.config.ts',
  }),
  output: {
    externals: ['@rsbuild/core'],
  },
  name: 'node',
  globals: true,
  restoreMocks: true,
  include: ['packages/**/*.test.ts'],
  exclude: ['packages/create-rsbuild/template-rstest'],
  setupFiles: ['./scripts/test-helper/rstest.setup.ts'],
});
