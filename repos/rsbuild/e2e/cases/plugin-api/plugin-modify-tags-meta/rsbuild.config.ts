import { defineConfig } from '@rsbuild/core';
import { myPlugin } from './myPlugin';

export default defineConfig({
  plugins: [myPlugin],
  html: {
    tags: [
      (tags) => {
        return tags.map((tag) => {
          if (tag.metadata?.from === 'my-plugin') {
            return { ...tag, attrs: { ...tag.attrs, id: 'foo' } };
          }
          return tag;
        });
      },
    ],
  },
});
