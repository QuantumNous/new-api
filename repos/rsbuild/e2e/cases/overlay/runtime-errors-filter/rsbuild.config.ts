import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  dev: {
    client: {
      overlay: {
        runtime: (error) => error.name !== 'AbortError',
      },
    },
  },
});
