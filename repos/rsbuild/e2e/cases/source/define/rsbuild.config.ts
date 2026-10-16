import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  source: {
    define: {
      ENABLE_TEST: JSON.stringify(true),
    },
  },
});
