import { defineConfig } from '@rsbuild/core';
import { pluginLess } from '@rsbuild/plugin-less';
import { pluginSass } from '@rsbuild/plugin-sass';

export default defineConfig({
  plugins: [pluginLess(), pluginSass()],
  output: {
    cssModules: {
      namedExport: true,
    },
  },
});
