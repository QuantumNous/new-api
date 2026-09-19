import path from 'node:path';
import { COMPILED_PATH } from '../constants';
import { castArray } from '../helpers';
import type { RsbuildPlugin, Rspack, SriAlgorithm } from '../types';

export const pluginSri = (): RsbuildPlugin => ({
  name: 'rsbuild:sri',

  setup(api) {
    api.modifyBundlerChain((chain, { environment, CHAIN_ID, rspack }) => {
      const { config } = environment;
      const { sri } = config.security;
      const enable = sri.enable === 'auto' ? config.mode === 'production' : sri.enable;

      if (!enable) {
        return;
      }

      // SRI requires a cross-origin policy
      const crossorigin = chain.output.get('crossOriginLoading');
      if (crossorigin === false || crossorigin === undefined) {
        chain.output.crossOriginLoading('anonymous');
      }

      const { algorithm = 'sha384' } = sri;
      const pluginOptions: Rspack.SubresourceIntegrityPluginOptions = {
        enabled: true,
        hashFuncNames: castArray(algorithm) as [SriAlgorithm, ...SriAlgorithm[]],
      };

      if (config.html.implementation === 'js' && config.tools.htmlPlugin !== false) {
        pluginOptions.htmlPlugin = path.join(COMPILED_PATH, 'html-rspack-plugin/index.js');
      }

      chain
        .plugin(CHAIN_ID.PLUGIN.SUBRESOURCE_INTEGRITY)
        .use(rspack.SubresourceIntegrityPlugin, [pluginOptions]);
    });
  },
});
