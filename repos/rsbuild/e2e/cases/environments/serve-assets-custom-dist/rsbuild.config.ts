import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  dev: {
    writeToDisk: true,
  },
  environments: {
    web1: {
      dev: {
        assetPrefix: '/web1/',
      },
      source: {
        entry: {
          index: './src/web1.js',
        },
      },
      output: {
        distPath: 'dist/web1',
      },
    },
    web2: {
      dev: {
        assetPrefix: '/web2/',
      },
      source: {
        entry: {
          index: './src/web2.js',
        },
      },
      output: {
        distPath: 'dist/web2',
      },
    },
  },
});
