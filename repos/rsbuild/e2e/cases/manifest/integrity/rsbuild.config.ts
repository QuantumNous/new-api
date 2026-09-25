import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  output: {
    manifest: true,
    filenameHash: false,
  },
  security: {
    sri: {
      enable: true,
    },
  },
});
