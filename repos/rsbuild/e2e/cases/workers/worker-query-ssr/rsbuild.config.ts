import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  environments: {
    node: {
      output: {
        target: 'node',
      },
      source: {
        entry: {
          index: './src/index.ts',
        },
      },
    },
  },
});
