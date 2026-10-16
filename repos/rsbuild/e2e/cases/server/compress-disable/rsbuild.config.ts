import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  splitChunks: false,
  output: {
    filenameHash: false,
  },
  server: {
    compress: false,
  },
});
