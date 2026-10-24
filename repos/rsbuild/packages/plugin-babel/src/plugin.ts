import { createRequire } from 'node:module';
import { isAbsolute, join } from 'node:path';
import type {
  EnvironmentContext,
  NormalizedEnvironmentConfig,
  RsbuildContext,
  RsbuildPlugin,
} from '@rsbuild/core';
import { applyUserBabelConfig, castArray, getBabelRuleId } from './helper.js';
import type { BabelLoaderOptions, PluginBabelOptions } from './types.js';

const require = createRequire(import.meta.url);
const BABEL_LOADER_PATH = require.resolve('babel-loader');
const { version: BABEL_LOADER_VERSION = '' } = require('babel-loader/package.json') as {
  version?: string;
};

export const PLUGIN_BABEL_NAME = 'rsbuild:babel';
const SCRIPT_REGEX = /\.(?:js|jsx|mjs|cjs|ts|tsx|mts|cts)$/;

function assertCoreVersion(version: string): void {
  if (version.split('.')[0] === '1') {
    throw new Error(
      `"@rsbuild/plugin-babel" v2 requires "@rsbuild/core" >= 2.0. Please upgrade "@rsbuild/core" or use "@rsbuild/plugin-babel" v1.`,
    );
  }
}

/**
 * The `@babel/preset-typescript` default options.
 */
const DEFAULT_BABEL_PRESET_TYPESCRIPT_OPTIONS = {
  allowNamespaces: true,
  allExtensions: true,
  allowDeclareFields: true,
  // aligns Babel's behavior with TypeScript's default behavior.
  // https://babeljs.io/docs/en/babel-preset-typescript#optimizeconstenums
  optimizeConstEnums: true,
  isTSX: true,
};

function getCacheDirectory(context: RsbuildContext, cacheDirectory?: string) {
  if (cacheDirectory) {
    return isAbsolute(cacheDirectory) ? cacheDirectory : join(context.rootPath, cacheDirectory);
  }
  return join(context.cachePath);
}

async function getCacheIdentifier(options: BabelLoaderOptions) {
  let identifier = `${process.env.NODE_ENV}${JSON.stringify(options)}`;

  const { version: coreVersion } = await import('@babel/core');

  identifier += `@babel/core@${coreVersion}`;
  identifier += `babel-loader@${BABEL_LOADER_VERSION}`;

  return identifier;
}

export function getDefaultBabelOptions(
  config: NormalizedEnvironmentConfig,
  context: RsbuildContext,
): BabelLoaderOptions {
  const isLegacyDecorators = config.source.decorators.version === 'legacy';

  const options: BabelLoaderOptions = {
    babelrc: false,
    configFile: false,
    compact: config.mode === 'production',
    plugins: [
      [require.resolve('@babel/plugin-proposal-decorators'), { ...config.source.decorators }],
      // If you are using @babel/preset-env and legacy decorators, you must ensure the class elements transform is enabled regardless of your targets, because Babel only supports compiling legacy decorators when also compiling class properties:
      // see https://babeljs.io/docs/babel-plugin-proposal-decorators#legacy
      ...(isLegacyDecorators ? [require.resolve('@babel/plugin-transform-class-properties')] : []),
    ],
    presets: [
      // TODO: only apply preset-typescript for ts file (isTSX & allExtensions false)
      [require.resolve('@babel/preset-typescript'), { ...DEFAULT_BABEL_PRESET_TYPESCRIPT_OPTIONS }],
    ],
  };

  // Enable caching by default to improve performance
  const { buildCache = true } = config.performance;
  if (buildCache) {
    const cacheDirectory = getCacheDirectory(
      context,
      typeof buildCache === 'boolean' ? undefined : buildCache.cacheDirectory,
    );

    // turn off compression to reduce overhead
    options.cacheCompression = false;
    options.cacheDirectory = join(cacheDirectory, 'babel-loader');
  }

  return options;
}

export const pluginBabel = (options: PluginBabelOptions = {}): RsbuildPlugin => ({
  name: PLUGIN_BABEL_NAME,

  setup(api) {
    assertCoreVersion(api.context.version);

    const getBabelOptions = async (environment: EnvironmentContext) => {
      const { config } = environment;
      const baseOptions = getDefaultBabelOptions(config, api.context);

      const mergedOptions = applyUserBabelConfig(baseOptions, options.babelLoaderOptions);

      // calculate cacheIdentifier with the merged options
      if (mergedOptions.cacheDirectory && !mergedOptions.cacheIdentifier) {
        mergedOptions.cacheIdentifier = await getCacheIdentifier(mergedOptions);
      }

      return mergedOptions;
    };

    api.modifyBundlerChain({
      order: 'pre',
      handler: async (chain, { CHAIN_ID, environment }) => {
        const babelOptions = await getBabelOptions(environment);
        const { include, exclude, parallel = false } = options;

        if (include || exclude) {
          const rule = chain.module
            .rule(getBabelRuleId(chain))
            // run babel loader before the builtin JS rule
            // https://stackoverflow.com/questions/32234329/what-is-the-loader-order-for-webpack
            .after(CHAIN_ID.RULE.JS);

          if (include) {
            for (const condition of castArray(include)) {
              rule.include.add(condition);
            }
          }
          if (exclude) {
            for (const condition of castArray(exclude)) {
              rule.exclude.add(condition);
            }
          }

          const loader = rule
            .test(SCRIPT_REGEX)
            .dependency({ not: 'url' })
            .resourceQuery({ not: /[?&]raw(?:&|=|$)/ })
            .with({ type: { not: 'text' } })
            .use(CHAIN_ID.USE.BABEL)
            .loader(BABEL_LOADER_PATH)
            .options(babelOptions);

          if (parallel) {
            loader.parallel(true);
          }
        } else {
          const loader = chain.module
            .rule(CHAIN_ID.RULE.JS)
            .test(SCRIPT_REGEX)
            .oneOfs.get(CHAIN_ID.ONE_OF.JS_MAIN)
            .use(CHAIN_ID.USE.BABEL)
            .after(CHAIN_ID.USE.SWC)
            .loader(BABEL_LOADER_PATH)
            .options(babelOptions);

          if (parallel) {
            loader.parallel(true);
          }
        }
      },
    });
  },
});
