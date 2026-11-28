import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  output: {
    assetPrefix: 'https://cdn.example.com/assets/',
    dataUriLimit: 0,
    manifest: true,
    filenameHash: false,
    sourceMap: true,
  },
  splitChunks: false,
});
