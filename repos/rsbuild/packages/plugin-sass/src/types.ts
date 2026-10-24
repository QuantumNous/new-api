import type { ConfigChainWithContext, Rspack } from '@rsbuild/core';
import type { LegacyOptions as LegacySassOptions, Options as SassOptions } from 'sass-embedded';
import type { LoaderOptions } from '../compiled/sass-loader/index.js';

export type SassLoaderOptions = Omit<LoaderOptions, 'api' | 'sassOptions' | 'additionalData'> &
  (
    | {
        api?: 'modern' | 'modern-compiler';
        sassOptions?: SassOptions<'async'>;
      }
    | {
        api: 'legacy';
        sassOptions?: Partial<LegacySassOptions<'async'>>;
      }
  ) & {
    // Use `Rspack.LoaderContext` instead of `webpack.LoaderContext`
    // see https://github.com/web-infra-dev/rsbuild/pull/2708
    additionalData?:
      | string
      | ((content: string | Buffer, loaderContext: Rspack.LoaderContext) => string);
  };

export type PluginSassOptions = {
  /**
   * Options passed to sass-loader.
   * @see https://github.com/webpack/sass-loader
   */
  sassLoaderOptions?: ConfigChainWithContext<
    SassLoaderOptions,
    {
      /**
       * @deprecated
       * use `exclude` option instead.
       */
      addExcludes: (items: string | RegExp | (string | RegExp)[]) => void;
    }
  >;

  /**
   * Include some `.scss` or `.sass` files, they will be transformed by sass-loader.
   * @default /\.s(?:a|c)ss$/
   */
  include?: Rspack.RuleSetCondition;

  /**
   * Exclude some `.scss` or `.sass` files, they will not be transformed by sass-loader.
   */
  exclude?: Rspack.RuleSetCondition;

  /**
   * Whether to use `resolve-url-loader` to rewrite urls.
   * @default true
   */
  rewriteUrls?: boolean;
};
