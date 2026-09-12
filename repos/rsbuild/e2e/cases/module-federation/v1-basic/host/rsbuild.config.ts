import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

export default defineConfig({
  plugins: [pluginReact()],
  moduleFederation: {
    options: {
      name: 'host',
      remotes: {
        remote: `remote@http://localhost:${process.env.REMOTE_PORT || 3002}${process.env.REMOTE_BASE || ''}/remoteEntry.js`,
      },
      shared: {
        react: {
          singleton: true,
          requiredVersion: '^19.0.0',
        },
        'react-dom': {
          singleton: true,
          requiredVersion: '^19.0.0',
        },
      },
    },
  },
  server: {
    cors: {
      origin: 'https://localhost',
    },
  },
});
