import { pureEsmPackage } from '@scripts/config/rslib.config.ts';
import { defineConfig } from '@rslib/core';

export default defineConfig({
  ...pureEsmPackage,
  lib: [
    ...pureEsmPackage.lib,
    {
      source: {
        entry: {
          assetLoader: './src/assetLoader.ts',
          loader: './src/loader.ts',
        },
      },
      output: {
        filename: {
          js: '[name].mjs',
        },
      },
    },
  ],
});
