import { pluginPreact } from '@rsbuild/plugin-preact';

export default {
  plugins: [
    pluginPreact({
      preactRefreshOptions: {
        exclude: [
          /node_modules/,
          // exclude Rsbuild internal HMR client
          /packages\/core\/dist/,
        ],
      },
    }),
  ],
};
