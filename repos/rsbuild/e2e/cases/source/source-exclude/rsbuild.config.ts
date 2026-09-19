import path from 'node:path';
import { defineConfig } from '@rsbuild/core';
import { pluginCheckSyntax } from '@rsbuild/plugin-check-syntax';

export default defineConfig({
  plugins: [pluginCheckSyntax()],
  source: {
    exclude: [path.resolve(import.meta.dirname, './src/test.js')],
  },
  output: {
    overrideBrowserslist: ['android >= 4.4'],
  },
});
