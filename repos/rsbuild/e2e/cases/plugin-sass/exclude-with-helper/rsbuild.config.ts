import { defineConfig } from '@rsbuild/core';
import { pluginSass } from '@rsbuild/plugin-sass';

export default defineConfig({
  tools: {
    bundlerChain(chain) {
      chain.module
        .rule('fallback')
        .test(/b\.scss$/)
        .type('asset/resource');
    },
  },
  plugins: [
    pluginSass({
      sassLoaderOptions: (_, { addExcludes }) => {
        addExcludes([/b\.scss$/]);
      },
    }),
  ],
});
