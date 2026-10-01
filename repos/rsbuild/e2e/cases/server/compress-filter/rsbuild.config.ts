import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  splitChunks: false,
  output: {
    filenameHash: false,
  },
  server: {
    compress: {
      filter: (req) => {
        return !req.url?.includes('index.js');
      },
    },
  },
});
