import { defineConfig } from '@rsbuild/core';
import { pluginSass } from '@rsbuild/plugin-sass';

export default defineConfig({
  plugins: [pluginSass()],
  tools: {
    cssLoader: {
      exportType: 'string',
      modules: {
        namedExport: true,
      },
    },
  },
});
