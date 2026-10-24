import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  security: {
    nonce: 'CSP_NONCE_PLACEHOLDER',
  },
});
