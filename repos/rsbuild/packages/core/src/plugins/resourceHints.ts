import { isRegExp } from 'node:util/types';
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

const appendExcludes = <T extends PrefetchOptions | PreloadOptions>(
  options: T | T[],
  excludes: RegExp[],
): T | T[] => {
  if (!excludes.length) {
    return options;
  }

  const optionsList = castArray(options).map((option) => ({
    ...option,
    exclude: option.exclude ? [...castArray(option.exclude), ...excludes] : excludes,
  }));

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

      if (prefetch) {
        const options = appendExcludes<PrefetchOptions>(
          prefetch === true ? {} : prefetch,
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
        const options = appendExcludes<PreloadOptions>(preload === true ? {} : preload, excludes);

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
