import { pluginReact } from '@rsbuild/plugin-react';

export default {
  plugins: [pluginReact()],
  performance: {
    dnsPrefetch: ['http://aaaa.com'],
  },
};
