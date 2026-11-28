import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  output: {
    filenameHash: false,
  },
  html: {
    tags: [
      {
        tag: 'script',
        attrs: { src: 'foo.js' },
        append: false,
      },
      (tags) => {
        tags.push({ tag: 'script', attrs: { src: 'bar.js' }, append: false });
        return tags;
      },
      { tag: 'script', attrs: { src: 'baz.js' }, append: false },
    ],
  },
});
