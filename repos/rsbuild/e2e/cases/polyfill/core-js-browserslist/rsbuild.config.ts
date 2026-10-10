import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  output: {
    polyfill: 'entry',
    sourceMap: {
      js: 'source-map',
    },
  },
});
