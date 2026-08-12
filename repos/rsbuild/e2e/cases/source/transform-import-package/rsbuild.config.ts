import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  source: {
    transformImport: [
      {
        libraryName: 'fixture-package',
        customName: 'fixture-package/{{ member }}',
      },
    ],
  },
  splitChunks: false,
});
