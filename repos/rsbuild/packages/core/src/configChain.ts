import { castArray, RspackChain } from './helpers';
import type { InternalContext, ModifyBundlerChainUtils } from './types';

export async function modifyBundlerChain(
  context: InternalContext,
  utils: ModifyBundlerChainUtils,
): Promise<RspackChain> {
  context.logger.debug('applying modifyBundlerChain hook');

  const rspackChain = new RspackChain();

  const [modifiedBundlerChain] = await context.hooks.modifyBundlerChain.callChain({
    environment: utils.environment.name,
    args: [rspackChain, utils],
  });

  if (utils.environment.config.tools?.bundlerChain) {
    for (const item of castArray(utils.environment.config.tools.bundlerChain)) {
      await item(modifiedBundlerChain, utils);
    }
  }

  context.logger.debug('applied modifyBundlerChain hook');

  return modifiedBundlerChain;
}

export const CHAIN_ID = {
  /** Predefined rules */
  RULE: {
    /** Rule for .mjs */
    MJS: 'mjs',
    /** Rule for fonts */
    FONT: 'font',
    /** Rule for JSON */
    JSON: 'json',
    /** Rule for images */
    IMAGE: 'image',
    /** Rule for media */
    MEDIA: 'media',
    /** Rule for additional assets */
    ADDITIONAL_ASSETS: 'additional-assets',
    /** Rule for JS */
    JS: 'js',
    /** Rule for data uri encoded javascript */
    JS_DATA_URI: 'js-data-uri',
    /** Rule for CSS */
    CSS: 'css',
    /** Rule for Less */
    LESS: 'less',
    /** Rule for Sass */
    SASS: 'sass',
    /** Rule for stylus */
    STYLUS: 'stylus',
    /** Rule for svg */
    SVG: 'svg',
    /** Rule for Vue */
    VUE: 'vue',
    /** Rule for wasm */
    WASM: 'wasm',
    /** Rule for svelte */
    SVELTE: 'svelte',
  },
  /** Predefined rule groups */
  ONE_OF: {
    /** JS oneOf rules */
    JS_MAIN: 'js',
    JS_WORKER: 'js-worker',
    JS_RAW: 'js-raw',
    JS_TEXT: 'js-text',
    /** CSS oneOf rules */
    CSS_MAIN: 'css',
    CSS_RAW: 'css-raw',
    CSS_TEXT: 'css-text',
    CSS_URL: 'css-url',
    CSS_INLINE: 'css-inline',
    /** SVG oneOf rules */
    SVG: 'svg',
    SVG_RAW: 'svg-asset-raw',
    SVG_TEXT: 'svg-asset-text',
    SVG_URL: 'svg-asset-url',
    SVG_ASSET: 'svg-asset',
    SVG_REACT: 'svg-react',
    SVG_INLINE: 'svg-asset-inline',
  },
  /** Predefined loaders */
  USE: {
    /** ts-loader */
    TS: 'ts',
    /** css-loader */
    CSS: 'css',
    /** CSS URL loader */
    CSS_URL: 'css-url',
    /** sass-loader */
    SASS: 'sass',
    /** less-loader */
    LESS: 'less',
    /** stylus-loader */
    STYLUS: 'stylus',
    /** url-loader */
    URL: 'url',
    /** vue-loader */
    VUE: 'vue',
    /** swc-loader */
    SWC: 'swc',
    /** worker query loader */
    WORKER_QUERY: 'worker-query',
    /** svgr */
    SVGR: 'svgr',
    /** babel-loader */
    BABEL: 'babel',
    /** style-loader */
    STYLE: 'style-loader',
    /** svelte-loader */
    SVELTE: 'svelte',
    /** postcss-loader */
    POSTCSS: 'postcss',
    /** lightningcss-loader */
    LIGHTNINGCSS: 'lightningcss',
    /** ignore-css-loader */
    IGNORE_CSS: 'ignore-css',
    /** CssExtractRspackPlugin.loader */
    MINI_CSS_EXTRACT: 'mini-css-extract',
    /** resolve-url-loader */
    RESOLVE_URL: 'resolve-url-loader',
  },
  /** Predefined plugins */
  PLUGIN: {
    /** HotModuleReplacementPlugin */
    HMR: 'hmr',
    /** CopyRspackPlugin */
    COPY: 'copy',
    /** HtmlRspackPlugin */
    HTML: 'html',
    /** DefinePlugin */
    DEFINE: 'define',
    /** ProgressPlugin */
    PROGRESS: 'progress',
    /** RspackManifestPlugin */
    MANIFEST: 'rspack-manifest',
    /** ForkTsCheckerWebpackPlugin */
    TS_CHECKER: 'ts-checker',
    /** ModuleFederationPlugin */
    MODULE_FEDERATION: 'module-federation',
    /** HtmlResourceHintsPlugin (prefetch) */
    HTML_PREFETCH: 'html-prefetch-plugin',
    /** HtmlResourceHintsPlugin (preload) */
    HTML_PRELOAD: 'html-preload-plugin',
    /** CssExtractRspackPlugin */
    MINI_CSS_EXTRACT: 'mini-css-extract',
    /** VueLoaderPlugin */
    VUE_LOADER_PLUGIN: 'vue-loader-plugin',
    /** ReactFastRefreshPlugin */
    REACT_FAST_REFRESH: 'react-fast-refresh',
    /** SubresourceIntegrityPlugin */
    SUBRESOURCE_INTEGRITY: 'subresource-integrity',
  },
  /** Predefined minimizers */
  MINIMIZER: {
    /** SwcJsMinimizerRspackPlugin */
    JS: 'js',
    /** LightningCssMinimizerRspackPlugin */
    CSS: 'css',
  },
} as const;

export type ChainIdentifier = typeof CHAIN_ID;
