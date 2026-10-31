import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  html: {
    template: './src/index.html',
    templateParameters: {
      items: ['Item 1', 'Item 2', 'Item 3'],
    },
  },
});
