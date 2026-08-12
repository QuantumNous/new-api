import { posix } from 'node:path';
import { getFilename } from '../helpers';
import type { RsbuildPlugin } from '../types';

export const pluginWasm = (): RsbuildPlugin => ({
  name: 'rsbuild:wasm',

  setup(api) {
    api.modifyBundlerChain((chain, { CHAIN_ID, environment, isProd }) => {
      const { config } = environment;
      const distPath = config.output.distPath.wasm;
      const filename = posix.join(distPath, getFilename(config, 'wasm', isProd));

      chain.output.webassemblyModuleFilename(filename);

      // support new URL('./abc.wasm', import.meta.url)
      chain.module
        .rule(CHAIN_ID.RULE.WASM)
        .test(/\.wasm$/)
        // only include assets that came from new URL calls
        .dependency('url')
        .type('asset/resource')
        .set('generator', {
          filename,
        });
    });
  },
});
