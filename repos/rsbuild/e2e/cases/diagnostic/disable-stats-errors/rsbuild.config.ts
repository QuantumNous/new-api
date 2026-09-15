import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  tools: {
    rspack: {
      stats: {
        errors: false,
      },
    },
  },
});
