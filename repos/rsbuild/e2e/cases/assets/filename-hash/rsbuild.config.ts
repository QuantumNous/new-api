import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

export default defineConfig({
  plugins: [pluginReact()],
  output: {
    filenameHash: 'fullhash:12',
    sourceMap: {
      js: false,
      css: false,
    },
  },
});
