import { NODE_MODULES_REGEX } from '../constants';
import type {
  ChunkSplit,
  ForceSplitting,
  NormalizedEnvironmentConfig,
  RsbuildPlugin,
  Rspack,
  SplitBySize,
  SplitChunks,
  SplitChunksPreset,
} from '../types';

type CacheGroups = Record<string, Rspack.OptimizationSplitChunksCacheGroup>;

interface Context {
  config: NormalizedEnvironmentConfig;
  rootPath: string;
  forceSplittingGroups: CacheGroups;
  override: Rspack.OptimizationSplitChunksOptions;
}

function getForceSplittingGroups(
  forceSplitting: ForceSplitting,
  strategy: ChunkSplit['strategy'],
): CacheGroups {
  const cacheGroups: CacheGroups = {};
  const pairs = Array.isArray(forceSplitting)
    ? forceSplitting.map((regexp, index) => [`force-split-${index}`, regexp] as const)
    : Object.entries(forceSplitting);

  for (const [key, regexp] of pairs) {
    cacheGroups[key] = {
      test: regexp,
      name: key,
      chunks: 'all',
      // ensure force splitting chunks have higher priority when chunkSplit is 'single-vendor'
      priority: strategy === 'single-vendor' ? 1 : 0,
      // Ignore minimum size, minimum chunks and maximum requests and always create chunks.
      enforce: true,
    };
  }

  return cacheGroups;
}

function resolveDefaultPreset(
  config: NormalizedEnvironmentConfig,
): Rspack.OptimizationSplitChunksOptions {
  const { polyfill } = config.output;
  if (polyfill === 'entry' || polyfill === 'usage') {
    return {
      cacheGroups: {
        'lib-polyfill': {
          name: 'lib-polyfill',
          test: /node_modules[\\/](?:tslib|core-js|@swc[\\/]helpers)[\\/]/,
          priority: 0,
        },
      },
    };
  }
  return {};
}

function resolvePerPackagePreset(): Rspack.OptimizationSplitChunksOptions {
  return {
    minSize: 0,
    maxInitialRequests: Number.POSITIVE_INFINITY,
    cacheGroups: {
      // Core group
      vendors: {
        priority: -9,
        test: NODE_MODULES_REGEX,
        name(module) {
          return module ? getPackageNameFromModulePath(module.context!) : undefined;
        },
      },
    },
  };
}

function resolveSingleVendorPreset(): Rspack.OptimizationSplitChunksOptions {
  return {
    cacheGroups: {
      singleVendor: {
        test: NODE_MODULES_REGEX,
        priority: 0,
        chunks: 'all',
        name: 'vendor',
        enforce: true,
      },
    },
  };
}

function splitByExperience(ctx: Context): SplitChunks {
  const { override, config, forceSplittingGroups } = ctx;
  return {
    ...getDefaultSplitChunksForWeb(config),
    ...override,
    cacheGroups: {
      ...resolveDefaultPreset(config)?.cacheGroups,
      ...forceSplittingGroups,
      ...override.cacheGroups,
    },
  };
}

export const MODULE_PATH_REGEX: RegExp =
  /.*[\\/]node_modules[\\/](?!\.pnpm[\\/])(?:(@[^\\/]+)[\\/])?([^\\/]+)/;

export function getPackageNameFromModulePath(modulePath: string): string | undefined {
  const handleModuleContext = modulePath?.match(MODULE_PATH_REGEX);

  if (!handleModuleContext) {
    return undefined;
  }

  const [, scope, name] = handleModuleContext;
  return `npm-${scope ? `${scope.replace('@', '')}_` : ''}${name}`;
}

function splitByModule(ctx: Context): SplitChunks {
  const { config, override, forceSplittingGroups } = ctx;
  const perPackageOptions = resolvePerPackagePreset();
  return {
    ...getDefaultSplitChunksForWeb(config),
    ...perPackageOptions,
    ...override,
    cacheGroups: {
      ...forceSplittingGroups,
      ...perPackageOptions.cacheGroups,
      ...override.cacheGroups,
    },
  };
}

function splitBySize(ctx: Context): SplitChunks {
  const { override, forceSplittingGroups, config } = ctx;
  const { minSize = 0, maxSize = Number.POSITIVE_INFINITY } = config.performance
    .chunkSplit as SplitBySize;

  return {
    ...getDefaultSplitChunksForWeb(config),
    minSize,
    maxSize,
    ...override,
    cacheGroups: {
      ...forceSplittingGroups,
      ...override.cacheGroups,
    },
  };
}

function splitCustom(ctx: Context): SplitChunks {
  const { config, override, forceSplittingGroups } = ctx;
  return {
    ...getDefaultSplitChunksForWeb(config),
    ...override,
    cacheGroups: {
      ...forceSplittingGroups,
      ...override.cacheGroups,
    },
  };
}

function allInOne(_ctx: Context): SplitChunks {
  return false;
}

function singleVendor(ctx: Context): SplitChunks {
  const { config, override, forceSplittingGroups } = ctx;
  return {
    ...getDefaultSplitChunksForWeb(config),
    ...override,
    cacheGroups: {
      ...resolveSingleVendorPreset().cacheGroups,
      ...forceSplittingGroups,
      ...override.cacheGroups,
    },
  };
}

const getDefaultSplitChunksForWeb = (
  config: NormalizedEnvironmentConfig,
): Rspack.OptimizationSplitChunksOptions => ({
  chunks: config.moduleFederation?.options?.exposes
    ? // split only `async` chunks for module federation provider app
      // this ensures that remote entries are not affected by chunk splitting
      'async'
    : // split both `initial` and `async` chunks for normal app
      'all',
});

function makeLegacySplitChunksOptions(
  chunkSplit: ChunkSplit,
  config: NormalizedEnvironmentConfig,
  rootPath: string,
) {
  let forceSplittingGroups = {};

  if (chunkSplit.forceSplitting) {
    forceSplittingGroups = getForceSplittingGroups(chunkSplit.forceSplitting, chunkSplit.strategy);
  }

  // Patch the override config difference between the `custom` strategy and other strategy.
  const override =
    chunkSplit.strategy === 'custom'
      ? (chunkSplit.splitChunks ?? chunkSplit.override)
      : chunkSplit.override;

  const dispatcher = {
    'all-in-one': allInOne,
    'split-by-experience': splitByExperience,
    'split-by-module': splitByModule,
    'split-by-size': splitBySize,
    'single-vendor': singleVendor,
    custom: splitCustom,
  };

  return dispatcher[chunkSplit.strategy || 'split-by-experience']({
    config,
    rootPath,
    override: override || {},
    forceSplittingGroups,
  });
}

function getSplitChunksByPreset(
  config: NormalizedEnvironmentConfig,
  preset?: SplitChunksPreset,
): Rspack.OptimizationSplitChunksOptions {
  if (!preset) {
    return {};
  }

  switch (preset) {
    case 'default':
      return resolveDefaultPreset(config);
    case 'single-vendor':
      return resolveSingleVendorPreset();
    case 'per-package':
      return resolvePerPackagePreset();
    case 'none':
      return {};
    default:
      throw new Error(`[rsbuild] Unknown splitChunks preset: ${preset}`);
  }
}

export const pluginSplitChunks = (): RsbuildPlugin => ({
  name: 'rsbuild:split-chunks',
  setup(api) {
    api.modifyBundlerChain((chain, { environment, isServer, isWebWorker }) => {
      const { config } = environment;
      const { splitChunks } = config;

      // Web Workers do not support dynamic imports; dynamicImportMode needs to be set to 'eager'
      if (isWebWorker) {
        chain.module.parser.merge({
          javascript: {
            dynamicImportMode: 'eager',
          },
        });
      }

      if (isServer || isWebWorker) {
        // Disable split chunks by default for server and worker builds
        if (splitChunks === false || Object.keys(splitChunks).length === 0) {
          chain.optimization.splitChunks(false);
        } else {
          const { preset = 'none', ...rest } = splitChunks;
          chain.optimization.splitChunks({
            ...getSplitChunksByPreset(config, preset),
            ...rest,
          });
        }
        return;
      }

      // Compatible with legacy `performance.chunkSplit` option
      const { chunkSplit } = config.performance;
      if (chunkSplit && splitChunks !== false && Object.keys(splitChunks).length === 0) {
        chain.optimization.splitChunks(
          makeLegacySplitChunksOptions(chunkSplit, config, api.context.rootPath),
        );
        return;
      }

      if (chunkSplit) {
        api.logger.warn(
          '[rsbuild:config] Both `performance.chunkSplit` and `splitChunks` are set. The `performance.chunkSplit` option is deprecated and will not work. Use `splitChunks` instead.',
        );
      }

      if (splitChunks === false) {
        chain.optimization.splitChunks(false);
      } else {
        const { preset = 'default', ...rest } = splitChunks;
        chain.optimization.splitChunks({
          ...getDefaultSplitChunksForWeb(config),
          ...getSplitChunksByPreset(config, preset),
          ...rest,
        });
      }
    });
  },
});
