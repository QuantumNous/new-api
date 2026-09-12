import { pluginReact } from '@rsbuild/plugin-react';

export default {
  plugins: [pluginReact()],
  performance: {
    chunkSplit: {
      strategy: 'all-in-one',
    },
  },
};
