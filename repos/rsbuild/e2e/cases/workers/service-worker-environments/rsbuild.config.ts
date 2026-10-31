import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  environments: {
    web: {},
    sw: {
      source: {
        entry: {
          sw: {
            import: './src/sw.js',
            html: false,
          },
        },
      },
      output: {
        target: 'web-worker',
        filenameHash: false,
        distPath: { js: '' },
      },
    },
  },
});
