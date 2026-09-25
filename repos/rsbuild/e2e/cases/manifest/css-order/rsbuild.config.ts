import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  source: {
    entry: {
      foo: './src/foo.js',
      bar: './src/bar.js',
      bar2: './src/bar.js',
    },
  },
  output: {
    manifest: true,
    filenameHash: false,
  },
  splitChunks: {
    preset: 'per-package',
  },
});
