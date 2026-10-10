import type { CssExtractRspackLoaderOptions, CssExtractRspackPluginOptions } from '@rspack/core';
import type * as Connect from 'connect-next';
import type HtmlRspackPlugin from 'html-rspack-plugin';
import type { AcceptedPlugin, ProcessOptions } from 'postcss';
import type { Rspack } from './rspack';
import type { LiteralUnion } from './utils';

export type { Connect };

export type { HtmlRspackPlugin };

export interface CSSExtractOptions {
  pluginOptions?: CssExtractRspackPluginOptions;
  loaderOptions?: CssExtractRspackLoaderOptions;
}

/**
 * A loose PostCSS plugin type that accepts plugins from different
 * PostCSS versions. This helps avoid type conflicts when user
 * projects use different PostCSS versions.
 */
export type LoosePostCSSPlugin = any;

export type PostCSSOptions = ProcessOptions & {
  config?: boolean;
  plugins?: LoosePostCSSPlugin[];
};

export type PostCSSLoaderOptions = {
  /**
   * Enable PostCSS Parser support in CSS-in-JS. If you use JS styles the postcss-js parser, add the execute option.
   * @default undefined
   */
  execute?: boolean;
  /**
   * Whether to generate source maps.
   * @default `rsbuildConfig.output.sourceMap.css`
   */
  sourceMap?: boolean;
  /**
   * The special implementation option determines which implementation of PostCSS to use.
   * @default `@rsbuild/core/compiled/postcss`
   */
  implementation?: unknown;
  /**
   * Allows to set PostCSS options and plugins.
   * @default undefined
   */
  postcssOptions?: PostCSSOptions | ((loaderContext: Rspack.LoaderContext) => PostCSSOptions);
};

export type PostCSSPlugin = AcceptedPlugin;

export type CSSLoaderModulesMode =
  | 'local'
  | 'global'
  | 'pure'
  | 'icss'
  | ((resourcePath: string) => 'local' | 'global' | 'pure' | 'icss');

export type CSSLoaderExportLocalsConvention =
  | 'asIs'
  | 'as-is'
  | 'camelCase'
  | 'camel-case'
  | 'camelCaseOnly'
  | 'camel-case-only'
  | 'dashes'
  | 'dashesOnly'
  | 'dashes-only'
  | ((name: string) => string);

export interface CSSLoaderModulesOptions {
  /**
   * Allows auto enable CSS Modules/ICSS based on the filename, query or fragment.
   */
  auto?:
    | boolean
    | RegExp
    | ((resourcePath: string, resourceQuery: string, resourceFragment: string) => boolean);
  /**
   * Allow `css-loader` to export names from global class or id, so you can use that as local name.
   */
  exportGlobals?: boolean;
  /**
   * Style of exported class names.
   */
  exportLocalsConvention?: CSSLoaderExportLocalsConvention;
  /**
   * Export only locals.
   */
  exportOnlyLocals?: boolean;
  /**
   * Allows to specify a function to generate the classname.
   */
  getLocalIdent?: (
    context: Rspack.LoaderContext,
    localIdentName: string,
    localName: string,
  ) => string;
  /**
   * Allows to configure the generated local ident name.
   */
  localIdentName?: string;
  /**
   * Allows to redefine basic loader context for local ident name.
   */
  localIdentContext?: string;
  /**
   * Allows to add custom hash to generate more unique classes.
   */
  localIdentHashSalt?: string;
  /**
   * Allows to specify hash function to generate classes.
   */
  localIdentHashFunction?: string;
  /**
   * Allows to specify hash digest to generate classes.
   */
  localIdentHashDigest?: string;
  /**
   * Allows to specify custom RegExp for local ident name.
   */
  localIdentRegExp?: string | RegExp;
  /**
   * Controls the level of compilation applied to the input styles.
   */
  mode?: CSSLoaderModulesMode;
  /**
   * Enables/disables ES modules named export for locals.
   */
  namedExport?: boolean;
  /**
   * Enables a callback to output the CSS Modules mapping JSON.
   */
  getJSON?: (context: {
    resourcePath: string;
    imports: object[];
    exports: object[];
    replacements: object[];
  }) => Promise<void> | void;
}

export interface CSSLoaderOptions {
  /**
   * Allow to enable/disables handling the CSS functions url and image-set.
   * If set to false, css-loader will not parse any paths specified in url or image-set
   * @default true
   */
  url?:
    | boolean
    | {
        filter: (url: string, resourcePath: string) => boolean;
      };
  /**
   * Allows to enables/disables @import at-rules handling.
   * @default true
   */
  import?:
    | boolean
    | {
        filter: (
          url: string,
          media: string,
          resourcePath: string,
          supports?: string,
          layer?: string,
        ) => boolean;
      };
  /**
   * Allows to enable/disable CSS Modules or ICSS and setup configuration:
   */
  modules?:
    | boolean
    | LiteralUnion<'local' | 'global' | 'pure' | 'icss', string>
    | CSSLoaderModulesOptions;
  /**
   * By default generation of source maps depends on the devtool option.
   */
  sourceMap?: boolean;
  /**
   * Allows to enables/disables or setups number of loaders applied before CSS loader for @import at-rules,
   * CSS Modules and ICSS imports, i.e. @import/composes/@value value from './values.css'/etc.
   * @default 0
   */
  importLoaders?: number;
  /**
   * By default, css-loader generates JS modules that use the ES modules syntax.
   * There are some cases in which using ES modules is beneficial, like in the case of module concatenation and tree shaking.
   * @default true
   */
  esModule?: boolean;
  /**
   * Allows exporting styles as array with modules, string or constructable stylesheet (i.e. CSSStyleSheet)
   * @default 'array'
   */
  exportType?: 'array' | 'string' | 'css-style-sheet';
}

export type StyleLoaderInjectType =
  | 'styleTag'
  | 'singletonStyleTag'
  | 'lazyStyleTag'
  | 'lazySingletonStyleTag'
  | 'linkTag';

export interface StyleLoaderOptions {
  /**
   * By default, style-loader generates JS modules that use the ES modules syntax.
   * There are some cases in which using ES modules is beneficial, like in the case of module concatenation and tree shaking.
   * @default true
   */
  esModule?: boolean;
  /**
   * Allows to setup how styles will be injected into the DOM.
   * @default 'styleTag'
   */
  injectType?: StyleLoaderInjectType;
  /**
   * If defined, the style-loader will attach given attributes with their values on <style> / <link> element.
   * @default {}
   */
  attributes?: Record<string, string>;
  /**
   * By default, style-loader appends <style>/<link> elements to the end of the style target,
   * which is the <head> tag of the page unless specified by insert.
   * This will cause CSS created by the loader to take priority over CSS already present in the target.
   * You can use other values if the standard behavior is not suitable for you, but we do not recommend doing this.
   * If you target an iframe, make sure you have sufficient access rights.
   *
   * Supports:
   * - a CSS selector where styles are injected
   * - an absolute path to a custom insert module
   *
   * @default 'head'
   */
  insert?: LiteralUnion<'head' | 'body', string>;
  /**
   * Allows to setup an absolute path to a custom module that overrides
   * the default styleTagTransform behavior.
   *
   * @default undefined
   */
  styleTagTransform?: string;
}
