import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  resolve: {
    alias: {
      '@': './src',
    },
  },
});
