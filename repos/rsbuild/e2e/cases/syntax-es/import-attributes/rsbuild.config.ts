import { fileURLToPath } from 'node:url';
import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  tools: {
    rspack: {
      module: {
        rules: [
          {
            with: { type: 'json' },
            loader: fileURLToPath(import.meta.resolve('./loaderWith.js')),
          },
        ],
      },
    },
  },
});
