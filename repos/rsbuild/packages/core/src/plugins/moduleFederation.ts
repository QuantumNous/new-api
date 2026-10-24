import { rspack } from '@rspack/core';
import type { RsbuildPlugin } from '../types';

export function pluginModuleFederation(): RsbuildPlugin {
  return {
    name: 'rsbuild:module-federation',

    setup(api) {
      api.modifyRsbuildConfig((config) => {
        const { moduleFederation } = config;

        if (!moduleFederation?.options) {
          return;
        }

        // Change some default configs for remote modules
        if (moduleFederation.options.exposes) {
          const userConfig = api.getRsbuildConfig('original');

          config.dev ||= {};
          config.server ||= {};

          // Allow remote modules to be loaded by setting CORS headers
          // This is required for MF to work properly across different origins
          if (userConfig.server?.cors === undefined) {
            config.server.cors = true;
          }

          // For remote modules, Rsbuild should send the ws request to the provider's dev server.
          // This allows the provider to do HMR when the provider module is loaded in the consumer's page.
          if (config.server?.port && !config.dev.client?.port) {
            config.dev.client ||= {};
            config.dev.client.port = config.server.port;
          }

          // Change the default assetPrefix to `true` for remote modules.
          // This ensures that the remote module's assets can be requested by consumer apps with the correct URL.
          if (
            userConfig.dev?.assetPrefix === undefined &&
            config.dev.assetPrefix === config.server?.base
          ) {
            config.dev.assetPrefix = true;
          }
        }
      });

      api.modifyEnvironmentConfig((config) => {
        if (!config.moduleFederation?.options) {
          return;
        }

        // Module Federation runtime uses ES6+ syntax,
        // adding to include and let SWC transform it
        config.source.include = [...(config.source.include || []), /@module-federation[\\/]/];
      });

      api.modifyBundlerChain((chain, { CHAIN_ID, target, environment }) => {
        const { config } = environment;

        if (!config.moduleFederation?.options || target !== 'web') {
          return;
        }

        const { options } = config.moduleFederation;

        chain
          .plugin(CHAIN_ID.PLUGIN.MODULE_FEDERATION)
          .use(rspack.container.ModuleFederationPlugin, [options]);

        if (options.name) {
          // `uniqueName` is required for react refresh to work
          if (!chain.output.get('uniqueName')) {
            chain.output.set('uniqueName', options.name);
          }
        }
      });
    },
  };
}
