import { defineConfig } from '@rsbuild/core';
import { pluginTailwindcss } from '@rsbuild/plugin-tailwindcss';

export default defineConfig({
  html: {
    template: './src/index.html',
  },
  output: {
    injectStyles: true,
  },
  plugins: [pluginTailwindcss()],
});
