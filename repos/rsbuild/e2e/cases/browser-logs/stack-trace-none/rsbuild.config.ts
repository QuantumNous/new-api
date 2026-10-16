import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  dev: {
    browserLogs: {
      stackTrace: 'none',
    },
  },
});
