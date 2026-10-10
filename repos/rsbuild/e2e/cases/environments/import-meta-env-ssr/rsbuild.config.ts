import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  environments: {
    web: {
      output: {
        filenameHash: false,
        minify: false,
      },
    },
    node: {
      output: {
        target: 'node',
        filenameHash: false,
        minify: false,
        distPath: 'dist/node',
      },
    },
  },
});
