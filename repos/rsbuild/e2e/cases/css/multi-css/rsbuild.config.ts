import { defineConfig } from '@rsbuild/core';
import { pluginLess } from '@rsbuild/plugin-less';
import { pluginSass } from '@rsbuild/plugin-sass';

export default defineConfig({
  plugins: [pluginLess(), pluginSass()],
  source: {
    entry: {
      entry1: './src/entry1/index.js',
      entry2: './src/entry2/index.js',
      entry3: './src/entry3/index.js',
    },
  },
});
