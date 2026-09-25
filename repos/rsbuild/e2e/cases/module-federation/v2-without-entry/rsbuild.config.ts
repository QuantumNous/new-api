import { pluginModuleFederation } from '@module-federation/rsbuild-plugin';
import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

export default defineConfig({
  plugins: [
    pluginReact(),
    pluginModuleFederation({
      name: 'remote',
      exposes: {
        './Button': './src/Button',
      },
      shared: ['react', 'react-dom'],
    }),
  ],
});
