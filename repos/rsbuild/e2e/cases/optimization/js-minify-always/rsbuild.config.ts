import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  output: {
    minify: {
      js: 'always',
    },
  },
});
