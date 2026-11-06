import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  dev: {
    lazyCompilation: {
      entries: false,
      imports: true,
    },
  },
});
