import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  tools: {
    lightningcssLoader: false,
  },
  output: {
    minify: false,
  },
});
