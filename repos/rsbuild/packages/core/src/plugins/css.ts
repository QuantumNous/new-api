import { rspack } from '@rspack/core';
import path, { posix } from 'node:path';
import deepmerge from 'deepmerge';
import type { AcceptedPlugin, PluginCreator } from 'postcss';
import postcssrc from 'postcss-load-config';
import { reduceConfigs, reduceConfigsWithContext } from 'reduce-configs';
import {
  CSS_REGEX,
  INLINE_QUERY_REGEX,
  LOADER_PATH,
  RAW_QUERY_REGEX,
  URL_QUERY_REGEX,
} from '../constants';
import { castArray, color, getFilename } from '../helpers';
import { getCompiledPath } from '../helpers/path';
import type {
  CSSLoaderModulesMode,
  CSSLoaderOptions,
  NormalizedEnvironmentConfig,
  PostCSSLoaderOptions,
  PostCSSOptions,
  RsbuildPlugin,
  Rspack,
  RspackChain,
  ToolsPostCSSContext,
} from '../types';
import { parseMinifyOptions } from './minimize';

const getCSSModulesLocalIdentName = (config: NormalizedEnvironmentConfig, isProd: boolean) =>
  config.output.cssModules.localIdentName ||
  // Using shorter classname in production to reduce bundle size
  (isProd ? '[local]-[hash:base64:6]' : '[path][name]__[local]-[hash:base64:6]');

export async function getLightningCSSLoaderOptions(
  config: NormalizedEnvironmentConfig,
  targets: string[],
  minify: boolean,
): Promise<Rspack.LightningcssLoaderOptions> {
  const userOptions =
    typeof config.tools.lightningcssLoader === 'object' ? config.tools.lightningcssLoader : {};

  const initialOptions: Rspack.LightningcssLoaderOptions = {
    targets,
    errorRecovery: true,
  };

  if (minify) {
    initialOptions.minify = true;
  }

  return reduceConfigs<Rspack.LightningcssLoaderOptions>({
    initial: initialOptions,
    config: userOptions,
  });
}

// If the target is not `web` and the modules option of css-loader is enabled,
// we must enable exportOnlyLocals to only exports the modules identifier mappings.
// Otherwise, the compiled CSS code may contain invalid code, such as `new URL`.
// https://github.com/webpack/css-loader#exportonlylocals
export const normalizeCssLoaderOptions = (
  options: CSSLoaderOptions,
  exportOnlyLocals: boolean,
): CSSLoaderOptions => {
  if (options.modules && exportOnlyLocals) {
    let { modules } = options;
    if (modules === true) {
      modules = { exportOnlyLocals: true };
    } else if (typeof modules === 'string') {
      modules = {
        mode: modules as CSSLoaderModulesMode,
        exportOnlyLocals: true,
      };
    } else {
      // create a new object to avoid modifying the original options
      modules = {
        ...modules,
        exportOnlyLocals: true,
      };
    }

    return {
      ...options,
      modules,
    };
  }

  return options;
};

// Create a new config object,
// ensure isolation of config objects between different builds
const clonePostCSSConfig = (config: PostCSSOptions) => ({
  ...config,
  plugins: config.plugins ? [...config.plugins] : undefined,
});

const getCSSSourceMap = (config: NormalizedEnvironmentConfig): boolean => {
  const { sourceMap } = config.output;
  return typeof sourceMap === 'boolean' ? sourceMap : sourceMap.css;
};

async function loadUserPostcssrc(
  root: string,
  postcssrcCache: PostcssrcCache,
): Promise<PostCSSOptions> {
  const cached = postcssrcCache.get(root);

  if (cached) {
    return clonePostCSSConfig(await cached);
  }

  const promise = postcssrc({}, root).catch((err: unknown) => {
    // ignore the config not found error
    if ((err as Error).message?.includes('No PostCSS Config found')) {
      return {};
    }
    throw err;
  });

  postcssrcCache.set(root, promise);

  return promise.then((config: PostCSSOptions) => {
    postcssrcCache.set(root, config);
    return clonePostCSSConfig(config);
  });
}

const isPostcssPluginCreator = (plugin: AcceptedPlugin): plugin is PluginCreator<unknown> =>
  typeof plugin === 'function' && (plugin as PluginCreator<unknown>).postcss;

const getPostcssLoaderOptions = async ({
  config,
  root,
  postcssrcCache,
}: {
  config: NormalizedEnvironmentConfig;
  root: string;
  postcssrcCache: PostcssrcCache;
}): Promise<PostCSSLoaderOptions> => {
  const extraPlugins: AcceptedPlugin[] = [];

  const context: ToolsPostCSSContext = {
    addPlugins(plugins: AcceptedPlugin | AcceptedPlugin[], options = {}) {
      const { order = 'post' } = options;
      const list = castArray(plugins);
      if (order === 'pre') {
        extraPlugins.unshift(...list);
      } else {
        extraPlugins.push(...list);
      }
    },
  };

  const userOptions = await loadUserPostcssrc(root, postcssrcCache);

  // init the plugins array
  userOptions.plugins ||= [];

  const defaultOptions: PostCSSLoaderOptions = {
    implementation: getCompiledPath('postcss'),
    postcssOptions: userOptions,
    sourceMap: getCSSSourceMap(config),
  };

  const finalOptions = await reduceConfigsWithContext({
    initial: defaultOptions,
    config: config.tools.postcss,
    ctx: context,
  });

  finalOptions.postcssOptions ||= {};

  const updatePostcssOptions = (options: PostCSSOptions) => {
    options.plugins ||= [];

    if (extraPlugins.length) {
      options.plugins.push(...extraPlugins);
    }

    // initialize the plugin to avoid multiple initialization
    // https://github.com/web-infra-dev/rsbuild/issues/3618
    options.plugins = options.plugins.map((plugin) =>
      isPostcssPluginCreator(plugin) ? plugin() : plugin,
    );

    // always use postcss-load-config to load external config
    options.config = false;

    return options;
  };

  const { postcssOptions } = finalOptions;
  if (typeof postcssOptions === 'function') {
    const postcssOptionsWrapper = (loaderContext: Rspack.LoaderContext) => {
      const options = postcssOptions(loaderContext);

      if (typeof options !== 'object' || options === null) {
        throw new Error(
          `${color.dim('[rsbuild:css]')} \`postcssOptions\` function must return a PostCSSOptions object, got ${color.yellow(
            typeof options,
          )}.`,
        );
      }

      const mergedOptions = {
        ...userOptions,
        ...options,
        plugins: [...(userOptions.plugins || []), ...(options.plugins || [])],
      };
      return updatePostcssOptions(mergedOptions);
    };

    // always use postcss-load-config to load external config
    postcssOptionsWrapper.config = false;

    return {
      ...finalOptions,
      postcssOptions: postcssOptionsWrapper,
    };
  }

  finalOptions.postcssOptions = updatePostcssOptions(postcssOptions);
  return finalOptions;
};

const getCSSLoaderOptions = async ({
  config,
  localIdentName,
  emitCss,
}: {
  config: NormalizedEnvironmentConfig;
  localIdentName: string;
  emitCss: boolean;
}) => {
  const { cssModules } = config.output;

  const defaultOptions: CSSLoaderOptions = {
    modules: {
      ...cssModules,
      localIdentName,
    },
    sourceMap: getCSSSourceMap(config),
  };

  const mergedCssLoaderOptions = await reduceConfigs({
    initial: defaultOptions,
    config: config.tools.cssLoader,
    mergeFn: deepmerge,
  });

  const cssLoaderOptions = normalizeCssLoaderOptions(mergedCssLoaderOptions, !emitCss);

  return cssLoaderOptions;
};

type PostcssrcCache = Map<string, PostCSSOptions | Promise<PostCSSOptions>>;

export const pluginCss = (): RsbuildPlugin => ({
  name: 'rsbuild:css',
  setup(api) {
    const postcssrcCache: PostcssrcCache = new Map();

    api.modifyBundlerChain({
      order: 'pre',
      handler: async (chain, { target, isProd, CHAIN_ID, environment, environments }) => {
        const cssRule = chain.module.rule(CHAIN_ID.RULE.CSS);
        const { config } = environment;

        cssRule
          .test(CSS_REGEX)
          // When using `new URL('./path/to/foo.css', import.meta.url)`,
          // the module should be treated as an asset module rather than a JS module.
          .dependency({ not: 'url' });

        // Support for `import cssText from "a.css" with { type: "text" }`
        cssRule.oneOf(CHAIN_ID.ONE_OF.CSS_TEXT).with({ type: 'text' }).type('asset/source');

        // Support for `import cssUrl from "a.css?url"`
        const urlRule = cssRule.oneOf(CHAIN_ID.ONE_OF.CSS_URL).resourceQuery(URL_QUERY_REGEX);
        urlRule.use(CHAIN_ID.USE.CSS_URL).loader(path.join(LOADER_PATH, 'cssUrlLoader.mjs'));

        // Support for `import inlineCss from "a.css?inline"`
        const inlineRule = cssRule
          .oneOf(CHAIN_ID.ONE_OF.CSS_INLINE)
          .resourceQuery(INLINE_QUERY_REGEX);

        // Support for `import rawCss from "a.css?raw"`
        cssRule.oneOf(CHAIN_ID.ONE_OF.CSS_RAW).type('asset/source').resourceQuery(RAW_QUERY_REGEX);

        // Default CSS handling
        const mainRule = cssRule.oneOf(CHAIN_ID.ONE_OF.CSS_MAIN);

        const emitCss = config.output.emitCss ?? target === 'web';

        // Create Rspack rule
        // Order: style-loader/CssExtractRspackPlugin -> css-loader -> postcss-loader
        if (emitCss) {
          // use style-loader
          if (config.output.injectStyles) {
            const styleLoaderOptions = await reduceConfigs({
              initial: {},
              config: config.tools.styleLoader,
            });
            mainRule
              .use(CHAIN_ID.USE.STYLE)
              .loader(getCompiledPath('style-loader'))
              .options(styleLoaderOptions);
          }
          // use CssExtractRspackPlugin loader
          else {
            mainRule
              .use(CHAIN_ID.USE.MINI_CSS_EXTRACT)
              .loader(rspack.CssExtractRspackPlugin.loader)
              .options(config.tools.cssExtract.loaderOptions);
          }
        } else {
          mainRule
            .use(CHAIN_ID.USE.IGNORE_CSS)
            .loader(path.join(LOADER_PATH, 'ignoreCssLoader.mjs'));
        }

        // Number of loaders applied before css-loader for `@import` at-rules
        const importLoaders = {
          normal: 0,
          inline: 0,
        };

        // Update CSS rules that share the CSS transform pipeline.
        const updateRules = async (
          callback: (
            rule: RspackChain.Rule<RspackChain.Rule>,
            type: 'main' | 'inline' | 'url',
          ) => void | Promise<void>,
          options: { skipMain?: boolean } = {},
        ) => {
          if (!options.skipMain) {
            await callback(mainRule, 'main');
          }
          await callback(inlineRule, 'inline');
          await callback(urlRule, 'url');
        };

        const cssLoaderPath = getCompiledPath('css-loader');
        await updateRules((rule) => {
          rule.use(CHAIN_ID.USE.CSS).loader(cssLoaderPath);
        });

        if (config.tools.lightningcssLoader !== false) {
          if (emitCss) {
            importLoaders.normal++;
          }
          importLoaders.inline++;

          let minifyCss = parseMinifyOptions(config).minifyCss;
          let { browserslist } = environment;

          // Use the same browserslist and minification as web bundles to ensure consistent
          // CSS output. Prevent mismatched prefixes or features between SSR and client hydration.
          if (target === 'node') {
            const webEnvironment = Object.values(environments).find(
              (env) => env.config.output.target === 'web',
            );
            if (webEnvironment) {
              browserslist = webEnvironment.browserslist;
              minifyCss = parseMinifyOptions(webEnvironment.config).minifyCss;
            }
          }

          await updateRules(
            async (rule, type) => {
              // Inline styles are not processed by Rspack's minimizers,
              // so we need to minify them via `builtin:lightningcss-loader`
              const inlineStyle = type === 'inline' || type === 'url' || config.output.injectStyles;
              const minify = inlineStyle && minifyCss;

              const lightningcssOptions = await getLightningCSSLoaderOptions(
                config,
                browserslist,
                minify,
              );

              rule
                .use(CHAIN_ID.USE.LIGHTNINGCSS)
                .loader('builtin:lightningcss-loader')
                .options(lightningcssOptions);
            },
            // If emit CSS is disabled, skip lightningcss-loader to reduce performance overhead
            { skipMain: !emitCss },
          );
        }

        const postcssLoaderOptions = await getPostcssLoaderOptions({
          config,
          root: api.context.rootPath,
          postcssrcCache,
        });

        // enable postcss-loader if using PostCSS plugins
        if (
          typeof postcssLoaderOptions.postcssOptions === 'function' ||
          postcssLoaderOptions.postcssOptions?.plugins?.length
        ) {
          if (emitCss) {
            importLoaders.normal++;
          }
          importLoaders.inline++;

          const postcssLoaderPath = getCompiledPath('postcss-loader');

          await updateRules(
            (rule) => {
              rule
                .use(CHAIN_ID.USE.POSTCSS)
                .loader(postcssLoaderPath)
                .options(postcssLoaderOptions);
            },
            // If emit CSS is disabled, skip postcss-loader to reduce performance overhead
            { skipMain: !emitCss },
          );
        }

        const localIdentName = getCSSModulesLocalIdentName(config, isProd);
        const cssLoaderOptions = await getCSSLoaderOptions({
          config,
          localIdentName,
          emitCss,
        });

        await updateRules((rule, type) => {
          let finalOptions = cssLoaderOptions;

          if (type === 'inline' || type === 'url') {
            finalOptions = {
              ...cssLoaderOptions,
              exportType: 'string',
              modules: false,
              importLoaders: importLoaders.inline,
            };
          } else {
            finalOptions = {
              ...cssLoaderOptions,
              importLoaders: importLoaders.normal,
            };
          }

          // Let ignoreCssLoader skip non-CSS Modules before css-loader runs
          if (!emitCss && type === 'main') {
            rule.use(CHAIN_ID.USE.IGNORE_CSS).options({
              modules: finalOptions.modules,
            });
          }

          rule.use(CHAIN_ID.USE.CSS).options(finalOptions);

          if (type !== 'url') {
            // CSS imports should always be treated as sideEffects.
            // CSS ?url only exports a URL string and does not apply styles.
            rule.sideEffects(true);
          }

          // Enable preferRelative by default, which is consistent with the default behavior of css-loader
          // see: https://github.com/webpack/css-loader/blob/579fc13/src/plugins/postcss-import-parser.js#L234
          rule.resolve.preferRelative(true);
        });

        const cssUrlFilename = getFilename(config, 'css', isProd);
        const cssUrlPath = config.output.distPath.css;

        urlRule.use(CHAIN_ID.USE.CSS_URL).options({
          filename:
            typeof cssUrlFilename === 'function'
              ? (pathData: Rspack.PathData, assetInfo?: Rspack.AssetInfo) =>
                  posix.join(cssUrlPath, cssUrlFilename(pathData, assetInfo))
              : posix.join(cssUrlPath, cssUrlFilename),
          modules: cssLoaderOptions.modules,
        });

        const isStringExport = cssLoaderOptions.exportType === 'string';
        if (isStringExport && mainRule.uses.has(CHAIN_ID.USE.MINI_CSS_EXTRACT)) {
          mainRule.uses.delete(CHAIN_ID.USE.MINI_CSS_EXTRACT);
        }

        // Apply CSS extract plugin if not using style-loader and emitCss is true
        if (emitCss && !config.output.injectStyles && !isStringExport) {
          const extractPluginOptions = config.tools.cssExtract.pluginOptions;

          const cssPath = config.output.distPath.css;
          const cssFilename = getFilename(config, 'css', isProd);
          const isCssFilenameFn = typeof cssFilename === 'function';

          const cssAsyncPath =
            config.output.distPath.cssAsync ?? (cssPath ? `${cssPath}/async` : 'async');

          chain.plugin(CHAIN_ID.PLUGIN.MINI_CSS_EXTRACT).use(rspack.CssExtractRspackPlugin, [
            {
              filename: isCssFilenameFn
                ? (...args) => {
                    const name = cssFilename(...args);
                    return posix.join(cssPath, name);
                  }
                : posix.join(cssPath, cssFilename),
              chunkFilename: isCssFilenameFn
                ? (...args) => {
                    const name = cssFilename(...args);
                    return posix.join(cssAsyncPath, name);
                  }
                : posix.join(cssAsyncPath, cssFilename),
              ...extractPluginOptions,
            },
          ]);
        }
      },
    });
  },
});
