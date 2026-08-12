import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  security: {
    sri: {
      enable: 'auto',
    },
  },
});
