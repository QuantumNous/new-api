import { defineConfig } from '@rsbuild/core';
import { pluginSvgr } from '@rsbuild/plugin-svgr';

export default defineConfig({
  plugins: [pluginSvgr()],
});
