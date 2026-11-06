import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  output: {
    filenameHash: false,
  },
  environments: {
    web: {
      source: {
        entry: {
          index: './src/index.client.js',
        },
      },
    },
    node: {
      source: {
        entry: {
          index: './src/index.server.js',
        },
      },
      output: {
        target: 'node',
        distPath: 'dist/server',
      },
    },
  },
});
