import { defineConfig } from '@rsbuild/core';
import { pluginCheckSyntax } from '@rsbuild/plugin-check-syntax';

export default defineConfig({
  plugins: [pluginCheckSyntax()],
  output: {
    overrideBrowserslist: ['android >= 4.4'],
  },
});
