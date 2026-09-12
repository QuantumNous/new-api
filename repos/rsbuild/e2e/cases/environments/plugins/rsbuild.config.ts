import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

export default defineConfig({
  environments: {
    web: {
      output: {
        filenameHash: false,
      },
      plugins: [pluginReact()],
    },
    web1: {
      source: {
        entry: {
          main: './src/index1.ts',
        },
      },
      output: {
        assetPrefix: 'auto',
        filenameHash: false,
        distPath: 'dist/web1',
      },
    },
  },
});
