import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

export default defineConfig({
  plugins: [pluginReact()],
  moduleFederation: {
    options: {
      name: 'remote',
      exposes: {
        './Button': './src/Button',
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
