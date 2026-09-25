import { fileURLToPath } from 'node:url';
import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  tools: {
    swc: {
      jsc: {
        experimental: {
          plugins: [
            [
              fileURLToPath(import.meta.resolve('@swc/plugin-remove-console')),
              {
                exclude: ['error'],
              },
            ],
          ],
        },
      },
    },
  },
});
