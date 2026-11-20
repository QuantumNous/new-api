import { castArray, color, createVirtualModule, isObject } from '../helpers';
import type { RsbuildEntryDescription, RsbuildPlugin, Rspack } from '../types';

export const pluginEntry = (): RsbuildPlugin => ({
  name: 'rsbuild:entry',

  setup(api) {
    api.modifyBundlerChain((chain, { environment, isServer }) => {
      const { config, entry } = environment;
      const { preEntry } = config.source;

      const injectCoreJsEntry = config.output.polyfill === 'entry' && !isServer;

      for (const entryName of Object.keys(entry)) {
        const entryPoint = chain.entry(entryName);
        const addEntry = (item: string | RsbuildEntryDescription) => {
          if (typeof item === 'object' && 'html' in item) {
            const { html: _html, ...rest } = item;
            entryPoint.add(rest);
          } else {
            entryPoint.add(item);
          }
        };

        preEntry.forEach(addEntry);

        if (injectCoreJsEntry) {
          addEntry(createVirtualModule('import "core-js";'));
        }

        castArray(entry[entryName]).forEach(addEntry);
      }
    });

    // Check missing entry config
    api.onBeforeCreateCompiler({
      order: 'post',
      handler: ({ bundlerConfigs }) => {
        const hasEntry = bundlerConfigs.some((config) => config.entry);
        if (hasEntry) {
          return;
        }

        const isModuleFederationPlugin = (plugin: Rspack.Plugin) =>
          isObject(plugin) && plugin.constructor.name === 'ModuleFederationPlugin';

        const hasModuleFederation = bundlerConfigs.some(({ plugins }) =>
          plugins?.some(isModuleFederationPlugin),
        );

        // Allow entry to be left empty when module federation is enabled
        if (hasModuleFederation) {
          bundlerConfigs.forEach((config) => {
            config.entry = {};
          });
          return;
        }

        throw new Error(
          `${color.dim('[rsbuild:config]')} Could not find any entry module, please make sure that ${color.yellow(
            'src/index.(ts|js|tsx|jsx|mts|cts|mjs|cjs)',
          )} exists, or customize entry through the ${color.yellow('source.entry')} configuration.`,
        );
      },
    });
  },
});
