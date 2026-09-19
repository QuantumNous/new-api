import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  output: {
    manifest: './custom/my-manifest.json',
    filenameHash: false,
  },
  splitChunks: false,
});
