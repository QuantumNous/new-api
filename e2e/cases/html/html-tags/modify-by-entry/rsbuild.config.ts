import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  source: {
    entry: {
      foo: './src/foo.js',
      bar: './src/bar.js',
    },
  },
  html: {
    tags: (tags, { entryName }) => {
      return [
        ...tags,
        {
          tag: 'script',
          attrs: { src: `https://www.cdn.com/${entryName}.js` },
        },
      ];
    },
  },
});
