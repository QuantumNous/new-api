import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

export default defineConfig({
  plugins: [pluginReact()],
  dev: {
    client: {
      overlay: {
        errors: (error) => !error.message.includes('filtered-overlay-error'),
      },
    },
  },
});
