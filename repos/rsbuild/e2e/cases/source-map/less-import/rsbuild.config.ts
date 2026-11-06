import { defineConfig } from '@rsbuild/core';
import { pluginLess } from '@rsbuild/plugin-less';

export default defineConfig({
  plugins: [pluginLess()],
  output: {
    filenameHash: false,
    minify: false,
    sourceMap: {
      css: true,
    },
  },
});
