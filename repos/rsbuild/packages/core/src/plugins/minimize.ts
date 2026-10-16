import type {
  LightningCssMinimizerRspackPluginOptions,
  SwcJsMinimizerRspackPluginOptions,
} from '@rspack/core';
import deepmerge from 'deepmerge';
import { isPlainObject, pick } from '../helpers';
import type { NormalizedEnvironmentConfig, RsbuildPlugin } from '../types';
import { getLightningCSSLoaderOptions } from './css';

const CONSOLE_METHODS = [
  'assert',
  'clear',
  'count',
  'countReset',
  'debug',
  'dir',
  'dirxml',
  'error',
  'group',
  'groupCollapsed',
  'groupEnd',
  'info',
  'log',
  'profile',
  'profileEnd',
  'table',
  'time',
  'timeEnd',
  'timeLog',
  'timeStamp',
  'trace',
  'warn',
];

const getConsolePureFuncs = (methods: readonly string[]) =>
  methods.map((method) => `console.${method}`);

const ALL_CONSOLE_PURE_FUNCS = getConsolePureFuncs(CONSOLE_METHODS);

export function getSwcMinimizerOptions(
  config: NormalizedEnvironmentConfig,
  jsOptions?: SwcJsMinimizerRspackPluginOptions,
): SwcJsMinimizerRspackPluginOptions {
  const options: SwcJsMinimizerRspackPluginOptions = {};

  options.minimizerOptions ||= {};
  options.minimizerOptions.format ||= {};

  const { removeConsole } = config.performance;

  if (removeConsole === true) {
    options.minimizerOptions.compress = {
      pure_funcs: ALL_CONSOLE_PURE_FUNCS,
    };
  } else if (Array.isArray(removeConsole)) {
    options.minimizerOptions.compress = {
      pure_funcs: getConsolePureFuncs(removeConsole),
    };
  }

  if (config.output.legalComments) {
    switch (config.output.legalComments) {
      case 'inline':
        options.minimizerOptions.format.comments = 'some';
        options.extractComments = false;
        break;
      case 'linked':
        options.extractComments = true;
        break;
      case 'none':
        options.minimizerOptions.format.comments = false;
        options.extractComments = false;
        break;
      default:
        break;
    }
  }

  options.minimizerOptions.format.asciiOnly = config.output.charset === 'ascii';

  if (jsOptions) {
    return deepmerge(options, jsOptions);
  }

  return options;
}

export function parseMinifyOptions(config: NormalizedEnvironmentConfig): {
  minifyJs: boolean;
  minifyCss: boolean;
  jsOptions?: SwcJsMinimizerRspackPluginOptions;
  cssOptions?: LightningCssMinimizerRspackPluginOptions;
} {
  const isProd = config.mode === 'production';
  const { minify = true } = config.output;

  if (typeof minify === 'boolean') {
    const shouldMinify = minify && isProd;
    return {
      minifyJs: shouldMinify,
      minifyCss: shouldMinify,
    };
  }

  return {
    minifyJs: minify.js !== false && (minify.js === 'always' || isProd),
    minifyCss: minify.css !== false && (minify.css === 'always' || isProd),
    jsOptions: minify.jsOptions,
    cssOptions: minify.cssOptions,
  };
}

export const pluginMinimize = (): RsbuildPlugin => ({
  name: 'rsbuild:minimize',

  setup(api) {
    api.modifyBundlerChain(async (chain, { environment, CHAIN_ID, rspack }) => {
      const { config } = environment;
      const { minifyJs, minifyCss, jsOptions, cssOptions } = parseMinifyOptions(config);

      chain.optimization.minimize(minifyJs || minifyCss);

      if (minifyJs) {
        chain.optimization
          .minimizer(CHAIN_ID.MINIMIZER.JS)
          .use(rspack.SwcJsMinimizerRspackPlugin, [getSwcMinimizerOptions(config, jsOptions)])
          .end();
      }

      if (minifyCss) {
        const loaderOptions = await getLightningCSSLoaderOptions(
          config,
          environment.browserslist,
          true,
        );

        const defaultOptions: LightningCssMinimizerRspackPluginOptions = {
          // If user has configured `tools.lightningcssLoader` options,
          // we should will use them as the default minimizer options.
          // This helps to keep development and production consistent.
          minimizerOptions: {
            targets: isPlainObject(loaderOptions.targets)
              ? environment.browserslist
              : loaderOptions.targets,
            ...pick(loaderOptions, [
              'drafts',
              'include',
              'exclude',
              'nonStandard',
              'pseudoClasses',
              'unusedSymbols',
              'errorRecovery',
            ]),
          },
        };

        const mergedOptions = cssOptions
          ? deepmerge<LightningCssMinimizerRspackPluginOptions>(defaultOptions, cssOptions)
          : defaultOptions;

        chain.optimization
          .minimizer(CHAIN_ID.MINIMIZER.CSS)
          .use(rspack.LightningCssMinimizerRspackPlugin, [mergedOptions])
          .end();
      }
    });
  },
});
