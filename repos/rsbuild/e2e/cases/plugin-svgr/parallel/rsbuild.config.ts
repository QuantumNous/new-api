import { pluginReact } from '@rsbuild/plugin-react';
import { pluginSvgr } from '@rsbuild/plugin-svgr';

export default {
  plugins: [
    pluginReact(),
    pluginSvgr({
      parallel: true,
      svgrOptions: {
        exportType: 'default',
      },
    }),
  ],
};
