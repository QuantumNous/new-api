import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  output: {
    polyfill: 'entry',
    filenameHash: false,
  },
  splitChunks: {
    cacheGroups: {
      'lib-polyfill': false,
    },
  },
});
