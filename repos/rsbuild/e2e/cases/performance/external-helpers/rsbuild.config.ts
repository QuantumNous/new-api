import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  source: {
    entry: { index: './src/main.ts' },
    decorators: {
      version: '2022-03',
    },
  },
  output: {
    sourceMap: {
      js: 'source-map',
    },
  },
});
