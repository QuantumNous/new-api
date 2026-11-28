import type { RsbuildPlugin } from '../types';

export const pluginProgress = (): RsbuildPlugin => ({
  name: 'rsbuild:progress',

  setup(api) {
    api.modifyBundlerChain((chain, { CHAIN_ID, environment, rspack }) => {
      const { config } = environment;
      const options = config.dev.progressBar;

      if (!options) {
        return;
      }

      const prefix = options !== true && options.id !== undefined ? options.id : environment.name;

      chain.plugin(CHAIN_ID.PLUGIN.PROGRESS).use(rspack.ProgressPlugin, [
        {
          prefix,
          ...(options === true ? {} : options),
        },
      ]);
    });
  },
});
