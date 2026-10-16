import { pluginReact } from '@rsbuild/plugin-react';

export default {
  plugins: [pluginReact()],
  environments: {
    foo: {
      source: {
        entry: {
          foo: './src/foo.js',
        },
      },
    },
    bar: {
      source: {
        entry: {
          bar: './src/bar.js',
        },
      },
    },
  },
};
