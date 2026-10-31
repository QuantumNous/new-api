import { pluginPreact } from '@rsbuild/plugin-preact';

export default {
  plugins: [
    pluginPreact({
      prefreshEnabled: false,
    }),
  ],
};
