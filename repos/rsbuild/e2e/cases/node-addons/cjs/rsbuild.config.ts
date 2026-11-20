import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  output: {
    target: 'node',
    filename: {
      js: '[name].cjs',
    },
    module: false,
  },
});
