import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

export default defineConfig({
  plugins: [pluginReact()],
  source: {
    entry: {
      eventError: './src/eventError.jsx',
      effectError: './src/effectError.jsx',
      undefinedError: './src/undefinedError.jsx',
    },
  },
});
