import { createRequire } from 'node:module';
import type { Minify, RsbuildPlugin, RspackChain } from '@rsbuild/core';

const require = createRequire(import.meta.url);

export const PLUGIN_TAILWINDCSS_NAME = 'rsbuild:tailwindcss';

export type PluginTailwindcssOptions = {
  /**
   * Enable Tailwind CSS's built-in Lightning CSS optimization.
   *
   * By default, this is enabled in production mode and disabled in development
   * mode. Minification follows Rsbuild's CSS minification config.
   *
   * @default true in production mode, false in development mode
   */
  optimize?:
    | boolean
    | {
        /**
         * Enable minification in Tailwind CSS's built-in Lightning CSS optimization.
         * @default Follows Rsbuild's CSS minification config.
         */
        minify?: boolean;
      };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const incrementCssImportLoaders = (rule: RspackChain.Rule<unknown>, cssUseId: string) => {
  if (!rule.uses.has(cssUseId)) {
    return;
  }

  const cssLoader = rule.uses.get(cssUseId);
  const options = cssLoader.get('options');

  if (!isRecord(options)) {
    return;
  }

  cssLoader.options({
    ...options,
    importLoaders: typeof options.importLoaders === 'number' ? options.importLoaders + 1 : 1,
  });
};

const isCssMinifyEnabled = (minify: Minify | undefined, isProd: boolean) => {
  if (typeof minify === 'boolean' || minify === undefined) {
    return (minify ?? true) && isProd;
  }

  return minify.css !== false && (minify.css === 'always' || isProd);
};

export const pluginTailwindcss = (options: PluginTailwindcssOptions = {}): RsbuildPlugin => ({
  name: PLUGIN_TAILWINDCSS_NAME,

  setup(api) {
    api.modifyBundlerChain((chain, { CHAIN_ID, environment, isProd, target }) => {
      if (!chain.module.rules.has(CHAIN_ID.RULE.CSS)) {
        return;
      }

      const { output } = environment.config;

      let { optimize } = options;
      if (optimize === undefined) {
        if (isProd) {
          optimize = { minify: isCssMinifyEnabled(output.minify, isProd) };
        } else {
          optimize = false;
        }
      }

      const tailwindOptions = {
        base: api.context.rootPath,
        optimize,
      };
      const emitCss = output.emitCss ?? target === 'web';

      const addTailwindLoader = (rule: RspackChain.Rule<unknown>) => {
        incrementCssImportLoaders(rule, CHAIN_ID.USE.CSS);

        rule
          .use('tailwindcss')
          .loader(require.resolve('@tailwindcss/webpack'))
          .options(tailwindOptions);
      };

      const cssRule = chain.module.rule(CHAIN_ID.RULE.CSS);
      addTailwindLoader(cssRule.oneOf(CHAIN_ID.ONE_OF.CSS_URL));
      if (emitCss) {
        addTailwindLoader(cssRule.oneOf(CHAIN_ID.ONE_OF.CSS_MAIN));
      }
      addTailwindLoader(cssRule.oneOf(CHAIN_ID.ONE_OF.CSS_INLINE));
    });
  },
});
