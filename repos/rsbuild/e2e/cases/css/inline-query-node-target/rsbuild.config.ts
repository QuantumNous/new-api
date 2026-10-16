import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  dev: {
    writeToDisk: true,
  },
  environments: {
    web: {},
    node: {
      output: {
        target: 'node',
        distPath: process.env.NODE_ENV === 'production' ? 'dist-build' : 'dist-dev',
      },
    },
  },
});
