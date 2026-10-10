import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  environments: {
    web1: {
      output: {
        distPath: 'dist/web1',
      },
    },
    web2: {
      output: {
        distPath: 'dist/web2',
      },
    },
  },
});
