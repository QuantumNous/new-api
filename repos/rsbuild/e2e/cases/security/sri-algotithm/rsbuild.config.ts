import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  security: {
    sri: {
      algorithm: 'sha512',
      enable: 'auto',
    },
  },
});
