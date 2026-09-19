import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  output: {
    filenameHash: false,
  },
  environments: {
    web: {
      resolve: {
        alias: {
          '@common': './src/common',
        },
      },
    },
    node: {
      resolve: {
        alias: {
          '@common': './src/common2',
        },
      },
      output: {
        target: 'node',
        distPath: 'dist/server',
      },
    },
  },
});
