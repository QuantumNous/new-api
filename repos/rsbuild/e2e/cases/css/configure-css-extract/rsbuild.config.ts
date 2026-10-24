import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  tools: {
    cssExtract: {
      pluginOptions: {
        filename: 'my-css.css',
      },
    },
  },
});
