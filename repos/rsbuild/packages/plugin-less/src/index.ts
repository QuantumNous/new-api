import path from 'node:path';
import type { ConfigChainWithContext, RsbuildPlugin, Rspack, RspackChain } from '@rsbuild/core';
import deepmerge from 'deepmerge';
import { reduceConfigsWithContext } from 'reduce-configs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export const isPlainObject = (obj: unknown): obj is Record<string, unknown> => {
  return obj !== null && typeof obj === 'object' && Object.getPrototypeOf(obj) === Object.prototype;
};

export const PLUGIN_LESS_NAME = 'rsbuild:less';

function assertCoreVersion(version: string): void {
  if (version.split('.')[0] === '1') {
    throw new Error(
      `"@rsbuild/plugin-less" v2 requires "@rsbuild/core" >= 2.0. Please upgrade "@rsbuild/core" or use "@rsbuild/plugin-less" v1.`,
    );
  }
}

export type LessLoaderOptions = {
  /**
   * Options passed to less.
   * @see https://lesscss.org/usage/#less-options
   */
  lessOptions?: import('../compiled/less/index.js').default.Options;
  /**
   * Prepends or appends Less code to the actual entry file.
   * This is especially useful when some of your Less variables
   * depend on the environment.
   */
  additionalData?:
    | string
    | ((
        content: string,
        loaderContext: Rspack.LoaderContext<LessLoaderOptions>,
      ) => string | Promise<string>);
  /**
   * Whether to source map generation.
   * @default depends on the `devtool` value of Rspack
   */
  sourceMap?: boolean;
  /**
   * Enables or disables the built-in Rspack resolver.
   * - If disabled, aliases and `@import` from node_modules will not work.
   * - If set to `only`, only the built-in Rspack resolver will be used
   * and `resolve.extensionAlias` can work.
   * @default true
   */
  webpackImporter?: boolean | 'only';
  /**
   * Determines which implementation of Less to use.
   * Can be used to override the pre-bundled version of less.
   * @default "less"
   */
  implementation?: unknown;
  /**
   * If enabled, Less warnings and errors will be treated as Rspack warnings
   * and errors, instead of being logged silently.
   *
   * If `lessLogAsWarnOrErr` is set to false it will be just a log and Rspack
   * will compile successfully, but if you set this option to true, Rspack
   * will compile fail with a warning(or error), and can break the build if
   * configured accordingly.
   * @default false
   */
  lessLogAsWarnOrErr?: boolean;
};

export type PluginLessOptions = {
  /**
   * Options passed to less-loader.
   * @see https://github.com/webpack/less-loader
   */
  lessLoaderOptions?: ConfigChainWithContext<
    LessLoaderOptions,
    {
      /**
       * @deprecated
       * use `exclude` option instead.
       */
      addExcludes: (items: string | RegExp | (string | RegExp)[]) => void;
    }
  >;
  /**
   * Include some `.less` files, they will be transformed by less-loader.
   * @default /\.less$/
   */
  include?: Rspack.RuleSetCondition;
  /**
   * Exclude some `.less` files, they will not be transformed by less-loader.
   * @default undefined
   */
  exclude?: Rspack.RuleSetCondition;
  /**
   * Whether to compile Less modules in parallel using worker threads. When enabled,
   * Less modules are processed across multiple worker threads, reducing pressure on
   * the main thread and improving overall build performance when compiling large
   * numbers of Less modules.
   *
   * Options transferred to worker threads must comply with the HTML structured clone
   * algorithm. For example, functions cannot be passed as options.
   * @see https://nodejs.org/api/worker_threads.html#portpostmessagevalue-transferlist
   * @default false
   */
  parallel?: boolean;
};

const getLessLoaderOptions = async (
  userOptions: PluginLessOptions['lessLoaderOptions'],
  isUseCssSourceMap: boolean,
  rootPath: string,
) => {
  const excludes: (RegExp | string)[] = [];

  const addExcludes = (items: string | RegExp | (string | RegExp)[]) => {
    excludes.push(...(Array.isArray(items) ? items : [items]));
  };

  const defaultLessLoaderOptions: LessLoaderOptions = {
    lessOptions: {
      javascriptEnabled: true,
      // let less resolve from node_modules in the current root directory,
      // Avoid resolving from wrong node_modules.
      paths: [path.join(rootPath, 'node_modules')],
    },
    sourceMap: isUseCssSourceMap,
  };

  const mergeFn = (
    defaults: LessLoaderOptions,
    userOptions: LessLoaderOptions,
  ): LessLoaderOptions => {
    const getLessOptions = () => {
      if (defaults.lessOptions && userOptions.lessOptions) {
        return deepmerge(defaults.lessOptions, userOptions.lessOptions, {
          isMergeableObject: isPlainObject,
        });
      }
      return userOptions.lessOptions || defaults.lessOptions;
    };

    return {
      ...defaults,
      ...userOptions,
      lessOptions: getLessOptions(),
    };
  };

  const mergedOptions = await reduceConfigsWithContext({
    initial: defaultLessLoaderOptions,
    config: userOptions,
    ctx: { addExcludes },
    mergeFn,
  });

  return {
    options: mergedOptions,
    excludes,
  };
};

// Find a unique rule id for the less rule,
// this allows to add multiple less rules.
const findRuleId = (chain: RspackChain, defaultId: string) => {
  let id = defaultId;
  let index = 0;
  while (chain.module.rules.has(id)) {
    id = `${defaultId}-${++index}`;
  }
  return id;
};

export const pluginLess = (pluginOptions: PluginLessOptions = {}): RsbuildPlugin => ({
  name: PLUGIN_LESS_NAME,

  setup(api) {
    assertCoreVersion(api.context.version);

    const { include = /\.less$/, parallel = false } = pluginOptions;

    const CSS_MAIN = 'css';
    const CSS_INLINE = 'css-inline';
    const CSS_RAW = 'css-raw';
    const LESS_MAIN = 'less';
    const LESS_TEXT = 'less-text';
    const LESS_URL = 'less-url';
    const LESS_INLINE = 'less-inline';
    const LESS_RAW = 'less-raw';

    api.modifyBundlerChain(async (chain, { CHAIN_ID, environment }) => {
      const { config } = environment;

      const lessRule = chain.module
        .rule(findRuleId(chain, CHAIN_ID.RULE.LESS))
        .test(include)
        .dependency({ not: 'url' })
        .resolve.preferRelative(true)
        .end();

      const getRule = (id: string) => {
        return (id.startsWith('less') ? lessRule : chain.module.rule(CHAIN_ID.RULE.CSS)).oneOf(id);
      };

      const cssRule = chain.module.rule(CHAIN_ID.RULE.CSS);
      const cssTextRuleId = CHAIN_ID.ONE_OF.CSS_TEXT;
      const hasCssTextRule = cssTextRuleId && cssRule.oneOfs.has(cssTextRuleId);
      const cssUrlRuleId = CHAIN_ID.ONE_OF.CSS_URL;
      const hasCssUrlRule = cssUrlRuleId && cssRule.oneOfs.has(cssUrlRuleId);

      // Less URL for `?url` imports.
      const lessUrlRule = hasCssUrlRule && getRule(LESS_URL);

      // Inline Less for `?inline` imports
      const lessInlineRule = getRule(LESS_INLINE);

      // Less text import with import attributes.
      if (hasCssTextRule) {
        getRule(LESS_TEXT).type('asset/source').with(getRule(cssTextRuleId).get('with'));
      }

      // Raw Less for `?raw` imports
      getRule(LESS_RAW).type('asset/source').resourceQuery(getRule(CSS_RAW).get('resourceQuery'));

      // Main Less transform
      const lessMainRule = getRule(LESS_MAIN);

      const { sourceMap } = config.output;
      const { excludes, options } = await getLessLoaderOptions(
        pluginOptions.lessLoaderOptions,
        typeof sourceMap === 'boolean' ? sourceMap : sourceMap.css,
        api.context.rootPath,
      );

      // Update the main, inline and URL rules.
      const updateRules = (
        callback: (
          rule: RspackChain.Rule<unknown>,
          cssBranchRule: RspackChain.Rule<unknown>,
          type: 'main' | 'inline' | 'url',
        ) => void,
      ) => {
        if (lessUrlRule) {
          callback(lessUrlRule, getRule(cssUrlRuleId), 'url');
        }
        callback(lessMainRule, getRule(CSS_MAIN), 'main');
        callback(lessInlineRule, getRule(CSS_INLINE), 'inline');
      };

      const lessLoaderPath = require.resolve('less-loader');

      updateRules((rule, cssBranchRule, type) => {
        for (const item of excludes) {
          rule.exclude.add(item);
        }
        if (pluginOptions.exclude) {
          rule.exclude.add(pluginOptions.exclude);
        }

        // Copy the builtin CSS rules
        if (type !== 'url') {
          rule.sideEffects(true);
        }
        rule.resourceQuery(cssBranchRule.get('resourceQuery'));

        for (const id of Object.keys(cssBranchRule.uses.entries())) {
          const loader = cssBranchRule.uses.get(id);
          const options = loader.get('options') ?? {};
          const clonedOptions = deepmerge<Record<string, any>>({}, options);

          if (id === CHAIN_ID.USE.CSS) {
            // add less-loader
            clonedOptions.importLoaders += 1;
          }

          rule.use(id).loader(loader.get('loader')).options(clonedOptions);
        }

        const loader = rule.use(CHAIN_ID.USE.LESS).loader(lessLoaderPath).options(options);

        if (parallel) {
          loader.parallel(true);
        }
      });
    });
  },
});
