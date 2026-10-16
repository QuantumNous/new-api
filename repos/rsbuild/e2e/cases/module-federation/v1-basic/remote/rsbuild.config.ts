import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

export default defineConfig({
  plugins: [pluginReact()],
  server: {
    cors: {
      origin: 'https://localhost',
    },
    port: Number(process.env.REMOTE_PORT) || 3002,
  },
  moduleFederation: {
    options: {
      name: 'remote',
      exposes: {
        './Button': './src/test-temp-Button',
      },
      filename: 'remoteEntry.js',
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
});
