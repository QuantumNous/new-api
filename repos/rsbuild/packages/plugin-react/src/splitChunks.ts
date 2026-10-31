import type { NormalizedEnvironmentConfig, RsbuildPluginAPI, Rspack } from '@rsbuild/core';
import type { SplitReactChunkOptions } from './index.js';

const isDefaultPreset = (config: NormalizedEnvironmentConfig) => {
  const { performance, splitChunks } = config;
  // Compatible with legacy `performance.chunkSplit` option
  if (performance.chunkSplit) {
    return performance.chunkSplit?.strategy === 'split-by-experience';
  }
  if (typeof splitChunks === 'object') {
    return !splitChunks.preset || splitChunks.preset === 'default';
  }
  return false;
};

export function applySplitChunksRule(
  api: RsbuildPluginAPI,
  options: SplitReactChunkOptions | boolean,
): void {
  api.modifyBundlerChain((chain, { environment, isProd }) => {
    const { config } = environment;
    if (!isDefaultPreset(config) || config.output.target !== 'web' || options === false) {
      return;
    }

    const normalizedOptions = options === true ? { react: true, router: true } : options;

    const currentConfig =
      chain.optimization.splitChunks.values() as Rspack.Optimization['splitChunks'];
    if (typeof currentConfig !== 'object') {
      return;
    }

    const extraGroups: Record<string, Rspack.OptimizationSplitChunksCacheGroup> = {};

    if (normalizedOptions.react) {
      extraGroups.react = {
        name: 'lib-react',
        test: isProd
          ? /node_modules[\\/](?:react|react-dom|scheduler)[\\/]/
          : /node_modules[\\/](?:react|react-dom|scheduler|react-refresh|@rspack[\\/]plugin-react-refresh)[\\/]/,
        priority: 0,
      };
    }

    if (normalizedOptions.router) {
      extraGroups.router = {
        name: 'lib-router',
        test: /node_modules[\\/](?:react-router|react-router-dom|history|@remix-run[\\/]router)[\\/]/,
        priority: 0,
      };
    }

    if (!Object.keys(extraGroups).length) {
      return;
    }

    chain.optimization.splitChunks({
      ...currentConfig,
      cacheGroups: {
        // user defined cache groups take precedence
        ...extraGroups,
        ...currentConfig.cacheGroups,
      },
    });
  });
}
