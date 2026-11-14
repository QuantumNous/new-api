import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  html: {
    tags: [
      {
        tag: 'link',
        attrs: {
          rel: 'manifest',
          href: '/manifest.webmanifest',
        },
      },
    ],
  },
});
