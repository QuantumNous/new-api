import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  output: {
    minify: {
      cssOptions: {
        minimizerOptions: {
          unusedSymbols: ['foo', 'fade-in', '--color'],
        },
      },
    },
  },
});
