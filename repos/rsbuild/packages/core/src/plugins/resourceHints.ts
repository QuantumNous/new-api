import { isRegExp } from 'node:util/types';
import { ASSET_EXTENSIONS } from '../constants';
import { castArray } from '../helpers';
import { getHTMLPlugin } from '../pluginHelper';
import { HtmlResourceHintsPlugin } from '../rspack-plugins/resource-hints/HtmlResourceHintsPlugin';
import type {
  HtmlBasicTag,
  NormalizedEnvironmentConfig,
  PreconnectOption,
  PrefetchOptions,
  PreloadOptions,
  RsbuildPlugin,
} from '../types';
import { getRegExpForExts } from './asset';
import { getInlineTests } from './inlineChunk';

const generateLinks = (
  options: PreconnectOption[],
  rel: 'preconnect' | 'dns-prefetch',
): HtmlBasicTag[] =>
  options.map((option) => ({
    tag: 'link',
    attrs: {
      rel,
      ...option,
    },
  }));

/**
 * If the asset is inlined via `output.inlineScripts` or `output.inlineStyles`,
 * it will be added to the HTML content directly, so we need to exclude it from
 * the resource hints. The function usage of `inlineScripts` and `inlineStyles`
 * is not yet supported, as it requires the `size` param.
 */
const getInlineExcludes = (config: NormalizedEnvironmentConfig): RegExp[] => {
  const { scriptTests, styleTests } = getInlineTests(config);
  return [...scriptTests, ...styleTests].filter((item) => isRegExp(item));
};

const applyExcludes = <T extends PrefetchOptions | PreloadOptions>(
  options: T | T[],
  defaultExclude: RegExp,
  excludes: RegExp[],
): T | T[] => {
  const optionsList = castArray(options).map((option): T => {
    const exclude = option.exclude ?? defaultExclude;

    if (!excludes.length && option.exclude !== undefined) {
      return option;
    }

    return {
      ...option,
      exclude: excludes.length ? [...castArray(exclude), ...excludes] : exclude,
    } as T;
  });

  return Array.isArray(options) ? optionsList : optionsList[0];
};

export const pluginResourceHints = (): RsbuildPlugin => ({
  name: 'rsbuild:resource-hints',

  setup(api) {
    api.modifyHTMLTags(({ headTags, bodyTags }, { environment }) => {
      const { config } = environment;
      const { dnsPrefetch, preconnect } = config.performance;

      if (dnsPrefetch) {
        const attrs = dnsPrefetch.map((option) => ({ href: option }));
        if (attrs.length) {
          headTags.unshift(...generateLinks(attrs, 'dns-prefetch'));
        }
      }

      if (preconnect) {
        const attrs = preconnect.map((option) =>
          typeof option === 'string' ? { href: option } : option,
        );
        if (attrs.length) {
          headTags.unshift(...generateLinks(attrs, 'preconnect'));
        }
      }

      return { headTags, bodyTags };
    });

    api.modifyBundlerChain((chain, { CHAIN_ID, environment, isDev }) => {
      const { config, htmlPaths } = environment;

      if (Object.keys(htmlPaths).length === 0) {
        return;
      }

      const {
        performance: { preload, prefetch },
      } = config;

      if (!preload && !prefetch) {
        return;
      }

      const HTMLCount = chain.entryPoints.values().length;
      const excludes = getInlineExcludes(config);
      const assetExclude = getRegExpForExts(ASSET_EXTENSIONS);

      if (prefetch) {
        const options = applyExcludes<PrefetchOptions>(
          prefetch === true ? {} : prefetch,
          assetExclude,
          excludes,
        );

        chain
          .plugin(CHAIN_ID.PLUGIN.HTML_PREFETCH)
          .use(HtmlResourceHintsPlugin, [
            options,
            'prefetch',
            HTMLCount,
            isDev,
            () => getHTMLPlugin(config),
          ]);
      }

      if (preload) {
        const options = applyExcludes<PreloadOptions>(
          preload === true ? {} : preload,
          assetExclude,
          excludes,
        );

        chain
          .plugin(CHAIN_ID.PLUGIN.HTML_PRELOAD)
          .use(HtmlResourceHintsPlugin, [
            options,
            'preload',
            HTMLCount,
            isDev,
            () => getHTMLPlugin(config),
          ]);
      }
    });
  },
});
