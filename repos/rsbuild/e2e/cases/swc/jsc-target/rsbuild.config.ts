import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  tools: {
    swc: {
      jsc: {
        target: 'es2015',
      },
    },
  },
  output: {
    minify: false,
  },
});
