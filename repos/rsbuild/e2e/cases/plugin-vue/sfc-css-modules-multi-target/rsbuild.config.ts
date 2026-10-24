import { defineConfig } from '@rsbuild/core';
import { pluginVue } from '@rsbuild/plugin-vue';

export default defineConfig({
  plugins: [pluginVue()],
  environments: {
    web: {
      output: {
        target: 'web',
        distPath: {
          root: './dist/web',
        },
      },
    },
    node: {
      output: {
        target: 'node',
        distPath: {
          root: './dist/node',
        },
      },
    },
  },
});
