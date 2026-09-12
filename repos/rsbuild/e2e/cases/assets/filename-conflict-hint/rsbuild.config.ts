import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  output: {
    filename: {
      image: 'image.png',
    },
    dataUriLimit: 0,
  },
});
