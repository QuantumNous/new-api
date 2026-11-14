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
          overlay: {
            runtime: true,
          },
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
          overlay: {
            runtime: false,
          },
        },
      },
    },
  },
});
