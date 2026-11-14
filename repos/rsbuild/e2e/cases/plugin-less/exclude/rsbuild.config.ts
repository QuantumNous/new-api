import { defineConfig } from '@rsbuild/core';
import { pluginLess } from '@rsbuild/plugin-less';

export default defineConfig({
  plugins: [
    pluginLess({
      exclude: /b\.less$/,
    }),
  ],
  tools: {
    bundlerChain(chain) {
      chain.module
        .rule('fallback')
        .test(/b\.less$/)
        .type('asset/resource');
    },
  },
});
