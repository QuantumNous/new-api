import { pluginSass } from '@rsbuild/plugin-sass';

export default {
  plugins: [
    pluginSass({
      exclude: /b\.scss$/,
    }),
  ],
};
