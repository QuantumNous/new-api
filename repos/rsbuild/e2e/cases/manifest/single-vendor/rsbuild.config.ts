import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  output: {
    manifest: true,
    filenameHash: false,
  },
  splitChunks: {
    preset: 'single-vendor',
  },
});
