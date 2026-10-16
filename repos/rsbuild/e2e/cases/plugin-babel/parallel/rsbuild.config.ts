import path from 'node:path';
import { pluginBabel } from '@rsbuild/plugin-babel';

export default {
  plugins: [
    pluginBabel({
      parallel: true,
      babelLoaderOptions: {
        plugins: [path.resolve(import.meta.dirname, './plugins/replace-message.mjs')],
      },
    }),
  ],
};
