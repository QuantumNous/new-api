import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  output: {
    filenameHash: false,
    distPath: {
      js: 'assets/js',
      jsAsync: 'assets/async',
    },
    filename: {
      js(pathData) {
        const name = pathData.chunk?.name;
        return `${name || 'chunk'}.bundle.js`;
      },
    },
  },
});
