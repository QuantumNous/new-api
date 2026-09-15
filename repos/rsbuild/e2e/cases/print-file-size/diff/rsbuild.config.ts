import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  splitChunks: {
    preset: 'single-vendor',
  },
  output: {
    filenameHash: 'contenthash:8',
  },
  performance: {
    printFileSize: {
      diff: true,
    },
  },
});
