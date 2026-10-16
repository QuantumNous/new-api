import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

export default defineConfig({
  plugins: [pluginReact()],
  source: {
    entry: {
      index: './src/index.js',
      foo: './src/foo.js',
      bar: './src/bar.js',
    },
  },
  server: {
    historyApiFallback: {
      index: '/index.html',
      rewrites: [{ from: /^\/baz/, to: '/foo.html' }],
    },
  },
});
