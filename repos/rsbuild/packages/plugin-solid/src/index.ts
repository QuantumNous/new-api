import { createRequire } from 'node:module';
import type { RsbuildPlugin } from '@rsbuild/core';
import { modifyBabelLoaderOptions } from '@rsbuild/plugin-babel';
import type { SolidPresetOptions } from './types.js';

const require = createRequire(import.meta.url);

export type PluginSolidOptions = {
  /**
   * Whether to resolve Solid's development runtime.
   * @default `true` in development mode, `false` in production mode
   */
  dev?: boolean;
  /**
   * Whether to generate output for Solid SSR.
   * @default false
   */
  ssr?: boolean;
  /**
   * Configure Solid Refresh for HMR in development mode.
   */
  refresh?: {
    /**
     * Whether to disable Solid Refresh while keeping Rsbuild HMR enabled.
     * @default false
     */
    disabled?: boolean;
  };
  /**
   * Options passed to `babel-preset-solid`.
   * @see https://npmjs.com/package/babel-preset-solid
   */
  solid?: SolidPresetOptions;
  /**
   * Options passed to `babel-preset-solid`.
   * If both `solid` and `solidPresetOptions` are set, `solid` takes precedence.
   * @deprecated Use `solid` instead.
   */
  solidPresetOptions?: SolidPresetOptions;
};

export const PLUGIN_SOLID_NAME = 'rsbuild:solid';

export function pluginSolid(options: PluginSolidOptions = {}): RsbuildPlugin {
  const { dev, solid, solidPresetOptions, ssr } = options;

  return {
    name: PLUGIN_SOLID_NAME,

    setup(api) {
      api.modifyEnvironmentConfig((config) => {
        const conditionNames = config.resolve.conditionNames ?? ['...'];
        const useDevRuntime = dev ?? config.mode === 'development';

        // Prefer Solid-specific exports while preserving user conditions or Rspack defaults.
        config.resolve.conditionNames = [
          ...new Set(['solid', ...(useDevRuntime ? ['development'] : []), ...conditionNames]),
        ];
      });

      api.modifyBundlerChain((chain, { CHAIN_ID, environment, isProd, target }) => {
        const environmentConfig = environment.config;

        modifyBabelLoaderOptions({
          chain,
          CHAIN_ID,
          modifier: (babelOptions) => {
            // Apply SSR defaults before user options so explicit values can override them.
            const defaultPresetOptions: SolidPresetOptions = ssr
              ? target === 'node'
                ? { generate: 'ssr', hydratable: true }
                : { generate: 'dom', hydratable: true }
              : {};

            babelOptions.presets = [
              [
                require.resolve('babel-preset-solid'),
                {
                  ...defaultPresetOptions,
                  ...solidPresetOptions,
                  ...solid,
                },
              ],
            ];
            babelOptions.parserOpts = { plugins: ['jsx', 'typescript'] };

            // `refresh.disabled` only disables Solid Refresh transforms; Rsbuild HMR can stay enabled.
            const usingHMR =
              options.refresh?.disabled !== true &&
              !isProd &&
              environmentConfig.dev.hmr &&
              target === 'web';
            if (usingHMR) {
              babelOptions.plugins ??= [];
              babelOptions.plugins.push([
                require.resolve('solid-refresh/babel'),
                { bundler: 'rspack-esm' },
              ]);

              chain.resolve.alias.set(
                'solid-refresh',
                require.resolve('solid-refresh/dist/solid-refresh.mjs'),
              );
            }

            return babelOptions;
          },
        });
      });
    },
  };
}
