import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  source: {
    entry: {
      main: './src/index.js',
      foo: './src/foo.js',
    },
  },
  html: {
    meta: {
      description: 'a description of the page',
    },
    inject: 'body',
    appIcon: {
      icons: [{ src: '../../../assets/icon.png', size: 180 }],
    },
    favicon: '../../../assets/icon.png',
  },
});
