import path from 'node:path';
import { pluginLess } from '@rsbuild/plugin-less';
import { pluginSass } from '@rsbuild/plugin-sass';

export default {
  plugins: [pluginLess(), pluginSass()],
  resolve: {
    alias: {
      '@common': path.resolve(import.meta.dirname, 'src/common'),
    },
  },
};
