import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  source: {
    entry: {
      index: './test-temp-src/index.js',
    },
  },
  output: {
    filenameHash: false,
  },
  tools: {
    rspack: {
      watchOptions: {
        ignored: /bar/,
      },
    },
  },
});
