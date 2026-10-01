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
      const templates: Record<string, string> = {
        foo: './public/foo.html',
        bar: './public/bar.html',
      };
      return templates[entryName];
    },
  },
});
