import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

export default defineConfig({
  plugins: [pluginReact()],
  output: {
    filenameHash: false,
  },
  performance: {
    chunkSplit: {
      strategy: 'single-vendor',
    },
  },
});
