import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

export default defineConfig({
  plugins: [pluginReact()],
  performance: {
    preconnect: [
      {
        href: 'http://aaaa.com',
      },
      {
        href: 'http://bbbb.com',
        crossorigin: true,
      },
    ],
  },
});
