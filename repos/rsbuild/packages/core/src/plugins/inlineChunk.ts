import { isRegExp } from 'node:util/types';
import { CSS_REGEX, JS_REGEX } from '../constants';
import { isFunction } from '../helpers';
import { getPublicPathFromCompiler } from '../helpers/compiler';
import { addTrailingSlash, ensureAssetPrefix } from '../helpers/url';
import type {
  HtmlBasicTag,
  InlineChunkTest,
  NormalizedEnvironmentConfig,
  RsbuildPlugin,
  Rspack,
} from '../types';

/**
 * If we inlined the chunk to HTML, we should update the value of sourceMappingURL,
 * because the relative path of source code has been changed.
 */
function updateSourceMappingURL({
  source,
  compilation,
  publicPath,
  type,
  config,
}: {
  source: string;
  compilation: Rspack.Compilation;
  publicPath: string;
  type: 'js' | 'css';
  config: NormalizedEnvironmentConfig;
}) {
  const { devtool } = compilation.options;

  if (
    devtool &&
    // If the source map is inlined, we do not need to update the sourceMappingURL
    !devtool.includes('inline') &&
    source.includes('# sourceMappingURL')
  ) {
    const prefix = addTrailingSlash(
      ensureAssetPrefix(config.output.distPath[type] || '', publicPath),
    );
    return source.replace(/# sourceMappingURL=/, `# sourceMappingURL=${prefix}`);
  }

  return source;
}

function matchTests(name: string, asset: Rspack.sources.Source, tests: InlineChunkTest[]) {
  return tests.some((test) => {
    if (isFunction(test)) {
      const size = asset.size();
      return test({ name, size });
    }
    return test.exec(name);
  });
}

export function getInlineTests(config: NormalizedEnvironmentConfig): {
  scriptTests: InlineChunkTest[];
  styleTests: InlineChunkTest[];
} {
  const isProd = config.mode === 'production';
  const { inlineStyles, inlineScripts } = config.output;
  const scriptTests: InlineChunkTest[] = [];
  const styleTests: InlineChunkTest[] = [];

  if (inlineScripts) {
    if (inlineScripts === true) {
      if (isProd) {
        scriptTests.push(JS_REGEX);
      }
    } else if (isRegExp(inlineScripts) || isFunction(inlineScripts)) {
      if (isProd) {
        scriptTests.push(inlineScripts);
      }
    } else {
      const enabled = inlineScripts.enable === 'auto' ? isProd : inlineScripts.enable;
      if (enabled) {
        scriptTests.push(inlineScripts.test);
      }
    }
  }

  if (inlineStyles) {
    if (inlineStyles === true) {
      if (isProd) {
        styleTests.push(CSS_REGEX);
      }
    } else if (isRegExp(inlineStyles) || isFunction(inlineStyles)) {
      if (isProd) {
        styleTests.push(inlineStyles);
      }
    } else {
      const enable = inlineStyles.enable === 'auto' ? isProd : inlineStyles.enable;
      if (enable) {
        styleTests.push(inlineStyles.test);
      }
    }
  }

  return { scriptTests, styleTests };
}

export const pluginInlineChunk = (): RsbuildPlugin => ({
  name: 'rsbuild:inline-chunk',

  setup(api) {
    const inlineAssetsByEnvironment = new Map<string, Set<string>>();

    const getInlinedAssetsSet = (name: string) => {
      let set = inlineAssetsByEnvironment.get(name);
      if (!set) {
        set = new Set<string>();
        inlineAssetsByEnvironment.set(name, set);
      }
      return set;
    };

    const getInlinedScriptTag = (
      publicPath: string,
      tag: HtmlBasicTag,
      compilation: Rspack.Compilation,
      inlinedAssets: Set<string>,
      scriptTests: InlineChunkTest[],
      config: NormalizedEnvironmentConfig,
    ) => {
      const { assets } = compilation;

      // No need to inline scripts with src attribute
      if (!(tag.attrs?.src && typeof tag.attrs.src === 'string')) {
        return tag;
      }

      const { src, ...otherAttrs } = tag.attrs;
      const scriptName = publicPath ? src.replace(publicPath, '') : src;

      // If asset is not found, skip it
      const asset = assets[scriptName];
      if (asset == null) {
        return tag;
      }

      const shouldInline = matchTests(scriptName, asset, scriptTests);
      if (!shouldInline) {
        return tag;
      }

      const source = asset.source().toString();
      const ret: HtmlBasicTag = {
        tag: 'script',
        children: updateSourceMappingURL({
          source,
          compilation,
          publicPath,
          type: 'js',
          config,
        }),
        attrs: {
          ...otherAttrs,
        },
      };

      // mark asset has already been inlined
      inlinedAssets.add(scriptName);

      return ret;
    };

    const getInlinedCSSTag = (
      publicPath: string,
      tag: HtmlBasicTag,
      compilation: Rspack.Compilation,
      inlinedAssets: Set<string>,
      styleTests: InlineChunkTest[],
      config: NormalizedEnvironmentConfig,
    ) => {
      const { assets } = compilation;

      // No need to inline styles with href attribute
      if (!(tag.attrs?.href && typeof tag.attrs.href === 'string')) {
        return tag;
      }

      const linkName = publicPath ? tag.attrs.href.replace(publicPath, '') : tag.attrs.href;

      // If asset is not found, skip it
      const asset = assets[linkName];
      if (asset == null) {
        return tag;
      }

      const shouldInline = matchTests(linkName, asset, styleTests);
      if (!shouldInline) {
        return tag;
      }

      const source = asset.source().toString();
      const ret: HtmlBasicTag = {
        tag: 'style',
        children: updateSourceMappingURL({
          source,
          compilation,
          publicPath,
          type: 'css',
          config,
        }),
      };

      // mark asset has already been inlined
      inlinedAssets.add(linkName);

      return ret;
    };

    const getInlinedTag = (
      publicPath: string,
      tag: HtmlBasicTag,
      compilation: Rspack.Compilation,
      inlinedAssets: Set<string>,
      scriptTests: InlineChunkTest[],
      styleTests: InlineChunkTest[],
      config: NormalizedEnvironmentConfig,
    ) => {
      if (tag.tag === 'script') {
        return getInlinedScriptTag(
          publicPath,
          tag,
          compilation,
          inlinedAssets,
          scriptTests,
          config,
        );
      }
      if (tag.tag === 'link' && tag.attrs && tag.attrs.rel === 'stylesheet') {
        return getInlinedCSSTag(publicPath, tag, compilation, inlinedAssets, styleTests, config);
      }
      return tag;
    };

    api.processAssets(
      {
        /**
         * Remove marked inline assets in summarize stage,
         * which should be later than the emitting of html-rspack-plugin
         */
        stage: 'summarize',
      },
      ({ compiler, compilation, environment }) => {
        const inlinedAssets = inlineAssetsByEnvironment.get(environment.name);
        if (!inlinedAssets || inlinedAssets.size === 0) {
          return;
        }

        const { devtool } = compiler.options;

        const hasSourceMap = devtool !== 'hidden-source-map' && devtool !== false;
        for (const name of inlinedAssets) {
          const asset = compilation.assets[name];
          if (!asset) {
            continue;
          }
          // Preserve source maps of inlined assets. Setting `related.sourceMap` to `null` prevents
          // `deleteAsset` from removing the source map file.
          if (hasSourceMap) {
            compilation.updateAsset(name, asset, {
              related: { sourceMap: null },
            });
          }
          compilation.deleteAsset(name);
        }

        inlinedAssets.clear();
      },
    );

    api.modifyHTMLTags(({ headTags, bodyTags }, { compiler, compilation, environment }) => {
      const { htmlPaths, config } = environment;

      if (Object.keys(htmlPaths).length === 0) {
        return { headTags, bodyTags };
      }

      const inlinedAssets = getInlinedAssetsSet(environment.name);

      const { scriptTests, styleTests } = getInlineTests(config);

      if (!scriptTests.length && !styleTests.length) {
        return { headTags, bodyTags };
      }

      const publicPath = getPublicPathFromCompiler(compiler);

      const updateTag = (tag: HtmlBasicTag) =>
        getInlinedTag(
          publicPath,
          tag,
          compilation,
          inlinedAssets,
          scriptTests,
          styleTests,
          environment.config,
        );

      return {
        headTags: headTags.map(updateTag),
        bodyTags: bodyTags.map(updateTag),
      };
    });
  },
});
