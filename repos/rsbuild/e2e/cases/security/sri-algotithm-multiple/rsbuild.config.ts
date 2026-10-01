import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  security: {
    sri: {
      algorithm: ['sha512', 'sha256', 'sha384'],
      enable: 'auto',
    },
  },
});
