import { defineConfig } from '@rsbuild/core';
import tailwindcss from '@tailwindcss/postcss';

export default defineConfig({
  source: {
    entry: {
      foo: './src/foo/index.js',
      bar: './src/bar/index.js',
    },
  },
  html: {
    template({ entryName }) {
      return `./src/${entryName}/index.html`;
    },
  },
  tools: {
    postcss: {
      postcssOptions(loaderContext) {
        return {
          plugins: [tailwindcss({ base: loaderContext.context ?? import.meta.dirname })],
        };
      },
    },
  },
});
