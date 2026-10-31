import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  output: {
    filename: {
      wasm: '[name].wasm',
    },
  },
});
