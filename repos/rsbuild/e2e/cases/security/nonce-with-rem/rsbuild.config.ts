import { defineConfig } from '@rsbuild/core';
import { pluginRem } from '@rsbuild/plugin-rem';

export default defineConfig({
  plugins: [pluginRem()],
  security: {
    nonce: 'CSP_NONCE_PLACEHOLDER',
  },
});
