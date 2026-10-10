import type { DefinePluginOptions } from '@rspack/core';
import { color } from '../helpers';
import { getPublicPathFromChain } from '../helpers/url';
import type { Logger } from '../logger';
import type { RsbuildPlugin } from '../types';

function checkProcessEnvSecurity(define: DefinePluginOptions, logger: Logger) {
  const value = define['process.env'];

  if (!value) {
    return;
  }

  const check = (value: Record<string, unknown>) => {
    const pathKey = Object.keys(value).find(
      // Windows uses `Path`, other platforms use `PATH`
      (key) => key.toLowerCase() === 'path' && value[key] === process.env[key],
    );

    if (!pathKey) {
      return;
    }

    logger.warn(
      `${color.dim('[rsbuild:config]')} The ${color.yellow(
        '"source.define"',
      )} option includes an object with the key ${color.yellow(
        JSON.stringify(pathKey),
      )} under ${color.yellow('"process.env"')}, indicating potential exposure of all environment variables. This can lead to security risks and should be avoided.`,
    );
  };

  // Check `{ 'process.env': process.env }`
  if (typeof value === 'object') {
    check(value as Record<string, unknown>);
    return;
  }

  // Check `{ 'process.env': JSON.stringify(process.env) }`
  if (typeof value === 'string') {
    try {
      check(JSON.parse(value));
    } catch {
      // ignore
    }
  }
}

export const pluginDefine = (): RsbuildPlugin => ({
  name: 'rsbuild:define',

  setup(api) {
    api.modifyBundlerChain((chain, { CHAIN_ID, rspack, environment }) => {
      const { config } = environment;

      const baseUrl = JSON.stringify(config.server.base);
      const assetPrefix = JSON.stringify(getPublicPathFromChain(chain, false));

      const builtinVars: DefinePluginOptions = {
        'import.meta.env': {
          MODE: JSON.stringify(config.mode),
          DEV: config.mode === 'development',
          PROD: config.mode === 'production',
          SSR: config.output.target === 'node',
          BASE_URL: baseUrl,
          ASSET_PREFIX: assetPrefix,
        },
        'process.env.BASE_URL': baseUrl,
        'process.env.ASSET_PREFIX': assetPrefix,
      };

      const mergedDefine = { ...builtinVars, ...config.source.define };

      checkProcessEnvSecurity(mergedDefine, api.logger);

      chain.plugin(CHAIN_ID.PLUGIN.DEFINE).use(rspack.DefinePlugin, [mergedDefine]);
    });
  },
});
