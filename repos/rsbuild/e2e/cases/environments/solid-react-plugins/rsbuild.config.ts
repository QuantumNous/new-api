import { defineConfig } from '@rsbuild/core';
import { pluginBabel } from '@rsbuild/plugin-babel';
import { pluginReact } from '@rsbuild/plugin-react';
import { pluginSolid } from '@rsbuild/plugin-solid';

export default defineConfig({
  environments: {
    react: {
      plugins: [pluginReact()],
      source: {
        entry: {
          react: './src/react/index.ts',
        },
      },
    },
    solid: {
      plugins: [
        pluginBabel({
          include: /\.(?:js|jsx|ts|tsx)$/,
        }),
        pluginSolid(),
      ],
      source: {
        entry: {
          solid: './src/solid/index.js',
        },
      },
    },
  },
});
