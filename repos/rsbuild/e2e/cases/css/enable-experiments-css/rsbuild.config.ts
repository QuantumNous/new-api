import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  tools: {
    rspack: {
      experiments: {
        css: true,
      },
    },
  },
  output: {
    filenameHash: false,
  },
});
