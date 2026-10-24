import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  resolve: {
    alias: {
      '@common': './src/common2',
    },
  },
  source: {
    tsconfigPath: 'tsconfig.custom.json',
  },
});
