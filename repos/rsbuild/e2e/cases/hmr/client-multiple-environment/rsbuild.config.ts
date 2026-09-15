import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  environments: {
    foo: {
      source: {
        entry: {
          foo: './src/foo.js',
        },
      },
      dev: {
        client: {
          host: 'http://foo.com',
        },
      },
    },
    bar: {
      source: {
        entry: {
          bar: './src/bar.js',
        },
      },
      dev: {
        client: {
          host: 'http://bar.com',
        },
      },
    },
  },
});
