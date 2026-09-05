import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  server: {
    cors: true,
    proxy: [
      {
        pathFilter: '/api',
        target: 'http://somepagewhichdoesnotexist.com:9000',
        changeOrigin: true,
        secure: false,
      },
    ],
  },
});
