import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

export default defineConfig({
  plugins: [
    pluginReact({
      splitChunks: {
        react: false,
      },
    }),
  ],
  output: {
    filenameHash: false,
  },
  performance: {
    chunkSplit: {
      strategy: 'single-vendor',
      forceSplitting: {
        'my-react': /node_modules[\\/]react[\\/]/,
      },
    },
  },
});
