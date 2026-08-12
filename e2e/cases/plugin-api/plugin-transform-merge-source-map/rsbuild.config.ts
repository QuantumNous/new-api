import { defineConfig } from '@rsbuild/core';
import { myPlugin } from './myPlugin';

export default defineConfig({
  plugins: [myPlugin],
  output: {
    sourceMap: true,
    filenameHash: false,
  },
});
