import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

export default defineConfig({
  plugins: [pluginReact()],
  source: {
    entry: {
      page1: './src/page1/index.js',
      page2: './src/page2/index.js',
    },
  },
  dev: {
    lazyCompilation: {
      serverUrl: 'http://localhost:<port>',
    },
  },
});
