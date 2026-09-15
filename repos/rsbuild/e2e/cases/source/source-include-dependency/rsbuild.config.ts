import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@rsbuild/core';
import { pluginCheckSyntax } from '@rsbuild/plugin-check-syntax';

export default defineConfig({
  plugins: [pluginCheckSyntax()],
  source: {
    include: [dirname(fileURLToPath(import.meta.resolve('test')))],
  },
  output: {
    overrideBrowserslist: ['Chrome >= 51'],
  },
});
