import { pluginModuleFederation } from '@module-federation/rsbuild-plugin';
import { defaultAllowedOrigins, defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

export default defineConfig({
  plugins: [
    pluginReact(),
    pluginModuleFederation({
      name: 'host',
      remotes: {
        remote: `remote@http://localhost:${process.env.REMOTE_PORT || 3002}/mf-manifest.json`,
      },
      shared: ['react', 'react-dom'],
    }),
  ],
  server: {
    cors: {
      origin: defaultAllowedOrigins,
    },
  },
});
