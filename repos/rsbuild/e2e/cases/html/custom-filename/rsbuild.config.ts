import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  source: {
    entry: {
      foo: './src/foo.js',
      bar: './src/bar.js',
    },
  },
  output: {
    filename: {
      html: 'custom-[name].html',
    },
  },
});
