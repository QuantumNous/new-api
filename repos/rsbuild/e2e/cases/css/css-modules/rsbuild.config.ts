import { pluginLess } from '@rsbuild/plugin-less';
import { pluginSass } from '@rsbuild/plugin-sass';

export default {
  plugins: [pluginLess(), pluginSass()],
};
