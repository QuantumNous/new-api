import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  output: {
    filenameHash: false,
    distPath: {
      image: '',
    },
    filename: {
      image: '[path][name][ext]',
    },
  },
});
