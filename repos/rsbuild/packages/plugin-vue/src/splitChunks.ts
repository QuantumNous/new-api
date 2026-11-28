import type { NormalizedEnvironmentConfig, RsbuildPluginAPI, Rspack } from '@rsbuild/core';
import type { SplitVueChunkOptions } from './index.js';

const isPlainObject = (obj: unknown): obj is Record<string, unknown> =>
  obj !== null &&
  typeof obj === 'object' &&
  Object.prototype.toString.call(obj) === '[object Object]';

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
  options: SplitVueChunkOptions = {
    vue: true,
    router: true,
  },
): void {
  api.modifyBundlerChain((chain, { environment }) => {
    const { config } = environment;
    if (!isDefaultPreset(config) || config.output.target !== 'web') {
      return;
    }

    const currentConfig =
      chain.optimization.splitChunks.values() as Rspack.Optimization['splitChunks'];
    if (!isPlainObject(currentConfig)) {
      return;
    }

    const extraGroups: Record<string, Rspack.OptimizationSplitChunksCacheGroup> = {};

    if (options.vue) {
      extraGroups.vue = {
        name: 'lib-vue',
        test: /node_modules[\\/](?:vue|rspack-vue-loader|@vue[\\/]shared|@vue[\\/]reactivity|@vue[\\/]runtime-dom|@vue[\\/]runtime-core)[\\/]/,
        priority: 0,
      };
    }

    if (options.router) {
      extraGroups.router = {
        name: 'lib-router',
        test: /node_modules[\\/]vue-router[\\/]/,
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
