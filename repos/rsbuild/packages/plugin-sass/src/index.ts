import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RsbuildPlugin, RspackChain } from '@rsbuild/core';
import deepmerge from 'deepmerge';
import { reduceConfigsWithContext } from 'reduce-configs';
import { getResolveUrlJoinFn, patchCompilerGlobalLocation } from './helpers.js';
import type { PluginSassOptions, SassLoaderOptions } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

export const PLUGIN_SASS_NAME = 'rsbuild:sass';

export type { PluginSassOptions };

function assertCoreVersion(version: string): void {
  if (version.split('.')[0] === '1') {
    throw new Error(
      `"@rsbuild/plugin-sass" v2 requires "@rsbuild/core" >= 2.0. Please upgrade "@rsbuild/core" or use "@rsbuild/plugin-sass" v1.`,
    );
  }
}

const getSassLoaderOptions = async (
  userOptions: PluginSassOptions['sassLoaderOptions'],
  isUseCssSourceMap: boolean,
): Promise<{
  options: SassLoaderOptions;
  excludes: (RegExp | string)[];
}> => {
  const excludes: (RegExp | string)[] = [];

  const addExcludes = (items: string | RegExp | (string | RegExp)[]) => {
    excludes.push(...(Array.isArray(items) ? items : [items]));
  };

  const mergeFn = (defaults: SassLoaderOptions, userOptions: SassLoaderOptions) => {
    const getSassOptions = () => {
      if (defaults.sassOptions && userOptions.sassOptions) {
        return deepmerge<SassLoaderOptions['sassOptions']>(
          defaults.sassOptions,
          userOptions.sassOptions,
        );
      }
      return userOptions.sassOptions || defaults.sassOptions;
    };

    return {
      ...defaults,
      ...userOptions,
      sassOptions: getSassOptions(),
    };
  };

  const mergedOptions = await reduceConfigsWithContext({
    initial: {
      sourceMap: isUseCssSourceMap,
      api: 'modern-compiler',
      implementation: require.resolve('sass-embedded'),
      sassOptions: {
        // mute deprecation warnings of dependencies
        quietDeps: true,
      },
    },
    config: userOptions,
    ctx: { addExcludes },
    mergeFn,
  });

  mergedOptions.sassOptions ||= {};

  if (!mergedOptions.sassOptions.silenceDeprecations) {
    // `import` is widely used and will not be removed within two years
    mergedOptions.sassOptions.silenceDeprecations = ['import'];

    if (mergedOptions.api === 'legacy') {
      // mute the noisy legacy API deprecation warnings
      mergedOptions.sassOptions.silenceDeprecations.push('legacy-js-api');
    }
  }

  return {
    options: mergedOptions,
    excludes,
  };
};

// Find a unique rule id for the sass rule,
// this allows to add multiple sass rules.
const findRuleId = (chain: RspackChain, defaultId: string) => {
  let id = defaultId;
  let index = 0;
  while (chain.module.rules.has(id)) {
    id = `${defaultId}-${++index}`;
  }
  return id;
};

export const pluginSass = (pluginOptions: PluginSassOptions = {}): RsbuildPlugin => ({
  name: PLUGIN_SASS_NAME,

  setup(api) {
    assertCoreVersion(api.context.version);

    const { rewriteUrls = true, include = /\.s(?:a|c)ss$/ } = pluginOptions;

    const CSS_MAIN = 'css';
    const CSS_INLINE = 'css-inline';
    const CSS_RAW = 'css-raw';
    const SASS_MAIN = 'sass';
    const SASS_TEXT = 'sass-text';
    const SASS_URL = 'sass-url';
    const SASS_INLINE = 'sass-inline';
    const SASS_RAW = 'sass-raw';

    api.onAfterCreateCompiler(({ compiler }) => {
      patchCompilerGlobalLocation(compiler);
    });

    api.modifyBundlerChain(async (chain, { CHAIN_ID, environment }) => {
      const { config } = environment;
      const { sourceMap } = config.output;
      const isUseSourceMap = typeof sourceMap === 'boolean' ? sourceMap : sourceMap.css;

      const { excludes, options } = await getSassLoaderOptions(
        pluginOptions.sassLoaderOptions,
        // If `rewriteUrls` is true, source maps are required for loaders that run before
        // `resolve-url-loader`, otherwise the `resolve-url-loader` will throw an error.
        rewriteUrls ? true : isUseSourceMap,
      );

      const sassRule = chain.module
        .rule(findRuleId(chain, CHAIN_ID.RULE.SASS))
        .test(include)
        .dependency({ not: 'url' })
        .resolve.preferRelative(true)
        .end();

      const cssRule = chain.module.rule(CHAIN_ID.RULE.CSS);
      const cssTextRuleId = CHAIN_ID.ONE_OF.CSS_TEXT;
      const hasCssTextRule = cssTextRuleId && cssRule.oneOfs.has(cssTextRuleId);
      const cssUrlRuleId = CHAIN_ID.ONE_OF.CSS_URL;
      const hasCssUrlRule = cssUrlRuleId && cssRule.oneOfs.has(cssUrlRuleId);

      const getRule = (id: string) => {
        return (id.startsWith('sass') ? sassRule : cssRule).oneOf(id);
      };

      // Sass URL for `?url` imports.
      const sassUrlRule = hasCssUrlRule && getRule(SASS_URL);

      // Inline Sass for `?inline` imports
      const sassInlineRule = getRule(SASS_INLINE);

      // Sass text import with import attributes.
      if (hasCssTextRule) {
        getRule(SASS_TEXT).type('asset/source').with(getRule(cssTextRuleId).get('with'));
      }

      // Raw Sass for `?raw` imports
      getRule(SASS_RAW).type('asset/source').resourceQuery(getRule(CSS_RAW).get('resourceQuery'));

      // Main Sass transform
      const sassMainRule = getRule(SASS_MAIN);

      // Update the main, inline and URL rules.
      const updateRules = (
        callback: (
          rule: RspackChain.Rule<unknown>,
          cssBranchRule: RspackChain.Rule<unknown>,
          type: 'main' | 'inline' | 'url',
        ) => void,
      ) => {
        if (sassUrlRule) {
          callback(sassUrlRule, getRule(cssUrlRuleId), 'url');
        }
        callback(sassMainRule, getRule(CSS_MAIN), 'main');
        callback(sassInlineRule, getRule(CSS_INLINE), 'inline');
      };

      const sassLoaderPath = path.join(__dirname, '../compiled/sass-loader/index.js');

      const resolveUrlLoaderPath = path.join(__dirname, '../compiled/resolve-url-loader/index.js');

      const resolveUrlLoaderOptions = {
        join: getResolveUrlJoinFn(),
        // 'resolve-url-loader' relies on 'adjust-sourcemap-loader',
        // it has performance regression issues in some scenarios,
        // so we need to disable the sourceMap option.
        sourceMap: false,
      };

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
            // add sass-loader and resolve-url-loader
            clonedOptions.importLoaders += rewriteUrls ? 2 : 1;
          }

          rule.use(id).loader(loader.get('loader')).options(clonedOptions);
        }

        // use `resolve-url-loader` to rewrite urls
        if (rewriteUrls) {
          rule
            .use(CHAIN_ID.USE.RESOLVE_URL)
            .loader(resolveUrlLoaderPath)
            .options(resolveUrlLoaderOptions)
            .end();
        }

        rule.use(CHAIN_ID.USE.SASS).loader(sassLoaderPath).options(options);
      });
    });
  },
});
