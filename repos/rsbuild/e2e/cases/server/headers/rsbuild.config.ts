import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  server: {
    headers: {
      'x-rsbuild-test': 'server-headers',
      'x-frame-options': 'DENY',
    },
  },
});
