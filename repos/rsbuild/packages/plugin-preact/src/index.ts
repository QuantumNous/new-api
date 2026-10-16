import { createRequire } from 'node:module';
import type { EnvironmentConfig, RsbuildPlugin, Rspack } from '@rsbuild/core';
import type { PluginOptions as PreactRefreshOptions } from '@rspack/plugin-preact-refresh';

const require = createRequire(import.meta.url);

export type PluginPreactOptions = {
  /**
   * Whether to aliases `react`, `react-dom` to `preact/compat`
   * @default true
   */
  reactAliasesEnabled?: boolean;
  /**
   * Whether to inject Prefresh for HMR
   * @default true
   */
  prefreshEnabled?: boolean;
  /**
   * Options passed to `@rspack/plugin-preact-refresh`.
   * @see https://github.com/rstackjs/rspack-plugin-preact-refresh
   */
  preactRefreshOptions?: PreactRefreshOptions;
};

export const PLUGIN_PREACT_NAME = 'rsbuild:preact';

function assertCoreVersion(version: string): void {
  if (version.split('.')[0] === '1') {
    throw new Error(
      `"@rsbuild/plugin-preact" v2 requires "@rsbuild/core" >= 2.0. Please upgrade "@rsbuild/core" or use "@rsbuild/plugin-preact" v1.`,
    );
  }
}

export const pluginPreact = (userOptions: PluginPreactOptions = {}): RsbuildPlugin => ({
  name: PLUGIN_PREACT_NAME,

  setup(api) {
    assertCoreVersion(api.context.version);

    const options = {
      prefreshEnabled: true,
      reactAliasesEnabled: true,
      ...userOptions,
    };

    api.modifyEnvironmentConfig((config, { mergeEnvironmentConfig }) => {
      const isDev = config.mode === 'development';
      const usePrefresh =
        isDev && options.prefreshEnabled && config.dev.hmr && config.output.target === 'web';

      const reactOptions: Rspack.SwcLoaderTransformConfig['react'] = {
        development: config.mode === 'development',
        refresh: usePrefresh,
        runtime: 'automatic',
        importSource: 'preact',
      };

      const extraConfig: EnvironmentConfig = {
        tools: {
          swc: {
            jsc: {
              experimental: {
                plugins: usePrefresh ? [[require.resolve('@swc/plugin-prefresh'), {}]] : undefined,
              },
              transform: {
                react: reactOptions,
              },
            },
          },
        },
      };

      extraConfig.source ||= {};
      extraConfig.resolve ||= {};

      if (usePrefresh) {
        // transpile `@prefresh/core` and `@prefresh/utils` to ensure browser compatibility
        extraConfig.source.include = [/node_modules[\\/]@prefresh[\\/](core|utils)/];
      }

      if (options.reactAliasesEnabled) {
        extraConfig.resolve.alias = {
          react: 'preact/compat',
          'react-dom/test-utils': 'preact/test-utils',
          'react-dom': 'preact/compat',
          'react/jsx-runtime': 'preact/jsx-runtime',
        };
      }

      return mergeEnvironmentConfig(extraConfig, config);
    });

    api.modifyBundlerChain(async (chain, { isDev, target }) => {
      const config = api.getNormalizedConfig();
      const usePrefresh = isDev && options.prefreshEnabled && config.dev.hmr && target === 'web';

      if (!usePrefresh) {
        return;
      }

      const { PreactRefreshRspackPlugin } = await import('@rspack/plugin-preact-refresh');

      const preactPath = require.resolve('preact', {
        paths: [api.context.rootPath],
      });

      chain.plugin('preact-refresh').use(PreactRefreshRspackPlugin, [
        {
          ...options.preactRefreshOptions,
          preactPath,
        },
      ]);
    });
  },
});
