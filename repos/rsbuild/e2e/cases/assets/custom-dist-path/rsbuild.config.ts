import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  output: {
    filenameHash: false,
    distPath: {
      root: 'dist/custom',
      js: 'my-js',
      jsAsync: 'my-async-js',
      css: 'my-css',
      cssAsync: 'my-async-css',
      html: 'my-html',
      image: 'my-image',
    },
  },
});
