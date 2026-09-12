import path from 'node:path';
import type { RsbuildPlugin, Rspack } from '@rsbuild/core';
import { PLUGIN_REACT_NAME } from '@rsbuild/plugin-react';
import type { Config as BaseSvgrOptions } from '@svgr/core';
import deepmerge from 'deepmerge';
import type { Config as SvgoConfig } from 'svgo';

// @svgr/core does not have the svgo dependency, so we need to
// manually specify the svgoConfig type
type SvgrOptions = Omit<BaseSvgrOptions, 'svgoConfig'> & {
  svgoConfig?: SvgoConfig;
};

type SvgoPluginConfig = NonNullable<SvgoConfig['plugins']>[0];

export type SvgDefaultExport = 'component' | 'url';

const SVG_REGEX = /\.svg$/;

export type PluginSvgrOptions = {
  /**
   * Configure SVGR options.
   * @see https://react-svgr.com/docs/options/
   */
  svgrOptions?: SvgrOptions;

  /**
   * Whether to allow the use of default import and named import at the same time.
   * @default false
   */
  mixedImport?: boolean;

  /**
   * Custom query suffix to match SVGR transformation.
   * @default /react/
   */
  query?: RegExp;

  /**
   * Whether to transform SVG modules into React components in parallel using worker
   * threads. When enabled, SVG modules are processed across multiple worker threads,
   * reducing pressure on the main thread and improving overall build performance
   * when compiling large numbers of SVG modules.
   *
   * Options transferred to worker threads must comply with the HTML structured clone
   * algorithm. For example, functions cannot be passed as options.
   * @see https://nodejs.org/api/worker_threads.html#portpostmessagevalue-transferlist
   * @default false
   */
  parallel?: boolean;

  /**
   * Exclude specific SVG files from SVGR transformation.
   */
  exclude?: Rspack.RuleSetCondition;

  /**
   * Exclude some modules, the SVGs imported by these modules will not be transformed by SVGR.
   */
  excludeImporter?: Rspack.RuleSetCondition;
};

const getSvgoDefaultConfig = (): SvgoConfig => ({
  plugins: [
    {
      name: 'preset-default',
      params: {
        overrides: {
          // viewBox is required to resize SVGs with CSS.
          // @see https://github.com/svg/svgo/issues/1128
          removeViewBox: false,
        },
      },
    },
    'prefixIds',
  ],
});

/**
 * Dedupe SVGO plugins config.
 *
 * @example
 * Input:
 *   {
 *     plugins: [
 *       { name: 'preset-default', params: { foo: true }],
 *       { name: 'preset-default', params: { bar: true }],
 *     ]
 *   }
 * Output:
 *   {
 *     plugins: [
 *       { name: 'preset-default', params: { foo: true, bar: true }],
 *     ]
 *   }
 */
const dedupeSvgoPlugins = (config: SvgoConfig): SvgoConfig => {
  if (!config.plugins) {
    return config;
  }

  let mergedPlugins: SvgoPluginConfig[] = [];

  for (const plugin of config.plugins) {
    if (typeof plugin === 'string') {
      const exist = mergedPlugins.find(
        (item) => item === plugin || (typeof item === 'object' && item.name === plugin),
      );

      if (!exist) {
        mergedPlugins.push(plugin);
      }

      continue;
    }

    const strIndex = mergedPlugins.findIndex(
      (item) => typeof item === 'string' && item === plugin.name,
    );
    if (strIndex !== -1) {
      mergedPlugins[strIndex] = plugin;
      continue;
    }

    let isMerged = false;

    mergedPlugins = mergedPlugins.map((item) => {
      if (typeof item === 'object' && item.name === plugin.name) {
        isMerged = true;
        return deepmerge<SvgoPluginConfig>(item, plugin);
      }
      return item;
    });

    if (!isMerged) {
      mergedPlugins.push(plugin);
    }
  }

  config.plugins = mergedPlugins;

  return config;
};

export const PLUGIN_SVGR_NAME = 'rsbuild:svgr';

function assertCoreVersion(version: string): void {
  if (version.split('.')[0] === '1') {
    throw new Error(
      `"@rsbuild/plugin-svgr" v2 requires "@rsbuild/core" >= 2.0. Please upgrade "@rsbuild/core" or use "@rsbuild/plugin-svgr" v1.`,
    );
  }
}

export const pluginSvgr = (options: PluginSvgrOptions = {}): RsbuildPlugin => ({
  name: PLUGIN_SVGR_NAME,

  pre: [PLUGIN_REACT_NAME],

  setup(api) {
    assertCoreVersion(api.context.version);
    const { parallel = false } = options;

    api.modifyBundlerChain((chain, { CHAIN_ID, environment }) => {
      const { config } = environment;
      const { dataUriLimit } = config.output;
      const maxSize = typeof dataUriLimit === 'number' ? dataUriLimit : dataUriLimit.svg;

      let generatorOptions: Rspack.GeneratorOptionsByModuleType['asset/resource'] = {};

      if (chain.module.rules.has(CHAIN_ID.RULE.SVG)) {
        generatorOptions = chain.module.rules
          .get(CHAIN_ID.RULE.SVG)
          .oneOfs.get(CHAIN_ID.ONE_OF.SVG_URL)
          .get('generator');

        // delete Rsbuild builtin SVG rules
        chain.module.rules.delete(CHAIN_ID.RULE.SVG);
      }

      const rule = chain.module.rule(CHAIN_ID.RULE.SVG).test(SVG_REGEX);

      const svgrOptions = deepmerge<
        SvgrOptions & Pick<Required<SvgrOptions>, 'svgo' | 'svgoConfig'>
      >(
        {
          svgo: true,
          svgoConfig: getSvgoDefaultConfig(),
        },
        options.svgrOptions || {},
      );

      svgrOptions.svgoConfig = dedupeSvgoPlugins(svgrOptions.svgoConfig);

      // get asset URL: "foo.svg?url"
      rule
        .oneOf(CHAIN_ID.ONE_OF.SVG_URL)
        .type('asset/resource')
        .resourceQuery(/^\?url$/)
        .set('generator', generatorOptions);

      // get inlined base64 content: "foo.svg?inline"
      rule
        .oneOf(CHAIN_ID.ONE_OF.SVG_INLINE)
        .type('asset/inline')
        .resourceQuery(/^\?inline$/);

      // get SVG source: `import source from "foo.svg" with { type: "text" }`
      if (CHAIN_ID.ONE_OF.SVG_TEXT) {
        rule.oneOf(CHAIN_ID.ONE_OF.SVG_TEXT).type('asset/source').with({ type: 'text' });
      }

      // get raw content: "foo.svg?raw"
      if (CHAIN_ID.ONE_OF.SVG_RAW) {
        rule
          .oneOf(CHAIN_ID.ONE_OF.SVG_RAW)
          .type('asset/source')
          .resourceQuery(/^\?raw$/);
      }

      // force to react component: "foo.svg?react"
      const svgReactUse = rule
        .oneOf(CHAIN_ID.ONE_OF.SVG_REACT)
        .type('javascript/auto')
        .resourceQuery(options.query || /react/)
        .use(CHAIN_ID.USE.SVGR)
        .loader(path.join(import.meta.dirname, 'loader.mjs'))
        .options({
          ...svgrOptions,
          exportType: 'default',
        } satisfies SvgrOptions);

      if (parallel) {
        svgReactUse.parallel(true);
      }

      // SVG in JS files
      const { mixedImport = false } = options;
      if (mixedImport || svgrOptions.exportType) {
        const { exportType = mixedImport ? 'named' : undefined } = svgrOptions;

        const issuerInclude = [/\.(?:js|jsx|mjs|cjs|ts|tsx|mts|cts)$/, /\.mdx$/];
        const issuer = options.excludeImporter
          ? { and: [issuerInclude, { not: options.excludeImporter }] }
          : issuerInclude;

        const svgRule = rule.oneOf(CHAIN_ID.ONE_OF.SVG);

        if (options.exclude) {
          svgRule.exclude.add(options.exclude);
        }

        const svgUse = svgRule
          .type('javascript/auto')
          // The issuer option ensures that SVGR will only apply if the SVG is imported from a JS file.
          .set('issuer', issuer)
          .use(CHAIN_ID.USE.SVGR)
          .loader(path.join(import.meta.dirname, 'loader.mjs'))
          .options({
            ...svgrOptions,
            exportType,
          });

        if (parallel) {
          svgUse.parallel(true);
        }

        /**
         * For mixed import.
         * @example import logoUrl, { ReactComponent } from './logo.svg';`
         */
        if (mixedImport && exportType === 'named') {
          svgRule
            .use(CHAIN_ID.USE.URL)
            .loader(path.join(import.meta.dirname, 'assetLoader.mjs'))
            .options({
              limit: maxSize,
              name: generatorOptions?.filename,
            });
        }
      }

      // SVG as assets
      rule
        .oneOf(CHAIN_ID.ONE_OF.SVG_ASSET)
        .type('asset')
        .parser({
          // Inline SVG if size < maxSize
          dataUrlCondition: {
            maxSize,
          },
        })
        .set('generator', generatorOptions);

      const jsRule = chain.module.rules.get(CHAIN_ID.RULE.JS);
      const jsMainRule = jsRule.oneOfs.get(CHAIN_ID.ONE_OF.JS_MAIN);

      [CHAIN_ID.USE.SWC, CHAIN_ID.USE.BABEL].some((jsUseId) => {
        const use = jsMainRule.uses.get(jsUseId);

        if (!use) {
          return false;
        }

        for (const oneOfId of [CHAIN_ID.ONE_OF.SVG, CHAIN_ID.ONE_OF.SVG_REACT]) {
          if (!rule.oneOfs.has(oneOfId)) {
            continue;
          }

          let loaderOptions = use.get('options');

          // disable React refresh runtime for SVGR transformed components
          if (jsUseId === CHAIN_ID.USE.SWC) {
            loaderOptions = deepmerge(loaderOptions, {
              jsc: {
                transform: {
                  react: {
                    refresh: false,
                  },
                },
              },
            });
          }

          // apply current JS transform loader to SVGR rules
          rule
            .oneOf(oneOfId)
            .use(jsUseId)
            .before(CHAIN_ID.USE.SVGR)
            .loader(use.get('loader'))
            .options(loaderOptions);
        }

        return true;
      });
    });
  },
});
