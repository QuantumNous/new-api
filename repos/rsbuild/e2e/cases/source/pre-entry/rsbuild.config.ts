import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  source: {
    preEntry: ['./src/pre.js'],
  },
});
