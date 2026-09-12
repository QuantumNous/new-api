import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

export default defineConfig({
  dev: {
    hmr: false,
  },
  plugins: [pluginReact()],
});
