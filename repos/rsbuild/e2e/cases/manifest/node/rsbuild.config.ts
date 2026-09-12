import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  output: {
    target: 'node',
    manifest: true,
    filenameHash: false,
  },
});
