import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  splitChunks: false,
  environments: {
    foo: {
      source: {
        entry: {
          foo: './src/foo.js',
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
        hmr: false,
        liveReload: false,
      },
    },
  },
});
