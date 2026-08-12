import { pluginLess } from '@rsbuild/plugin-less';

export default {
  output: {
    filenameHash: false,
  },
  plugins: [pluginLess()],
};
