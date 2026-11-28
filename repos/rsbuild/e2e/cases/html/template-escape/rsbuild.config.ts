import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  source: {
    entry: {
      foo: './src/foo.js',
      bar: './src/bar.js',
    },
  },
  html: {
    template({ entryName }) {
      return `./static/${entryName}.html`;
    },
  },
});
