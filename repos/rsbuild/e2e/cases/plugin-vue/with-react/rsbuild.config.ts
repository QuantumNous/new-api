import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { pluginVue } from '@rsbuild/plugin-vue';

export default defineConfig({
  // pluginReact should be used before pluginVue to test the issue
  // see https://github.com/web-infra-dev/rsbuild/discussions/4712
  plugins: [pluginReact(), pluginVue()],
});
