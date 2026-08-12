import { defineConfig } from '@rsbuild/core';
import { pluginLess } from '@rsbuild/plugin-less';

export default defineConfig({
  tools: {
    bundlerChain(chain) {
      chain.module
        .rule('fallback')
        .test(/b\.less$/)
        .type('asset/resource');
    },
  },
  plugins: [
    pluginLess({
      lessLoaderOptions: (_, { addExcludes }) => {
        addExcludes([/b\.less$/]);
      },
    }),
  ],
});
