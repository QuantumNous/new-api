import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  html: {
    template: './src/index.html',
    templateParameters: {
      showBasic: true,
      // If/else condition
      condition: false,
      // If/else if/else values
      value: 7,
      // Nested if conditions
      outer: true,
      inner: true,
      // Conditional expression
      showResult: true,
      result: 'Success',
    },
  },
});
