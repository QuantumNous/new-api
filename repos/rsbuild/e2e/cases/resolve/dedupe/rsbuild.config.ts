import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  splitChunks: false,
});
