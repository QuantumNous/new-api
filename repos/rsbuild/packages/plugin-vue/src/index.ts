import { createRequire } from 'node:module';
import type { EnvironmentConfig, RsbuildPlugin, Rspack } from '@rsbuild/core';
import { type VueLoaderOptions, VueLoaderPlugin } from 'rspack-vue-loader';
import { applySplitChunksRule } from './splitChunks.js';

const require = createRequire(import.meta.url);

export type SplitVueChunkOptions = {
  /**
   * Whether to enable split chunking for Vue-related dependencies (e.g., vue, rspack-vue-loader).
   * @default true
   */
  vue?: boolean;
  /**
   * Whether to enable split chunking for vue-router.
   * @default true
   */
  router?: boolean;
};

export type PluginVueOptions = {
  /**
   * Test condition to match Vue files.
   * @default /\.vue$/
   */
  test?: Rspack.RuleSetCondition;
  /**
   * Options passed to `rspack-vue-loader`.
   * @see https://vue-loader.vuejs.org/
   */
  vueLoaderOptions?: VueLoaderOptions;
  /**
   * This option is used to control the split chunks behavior.
   */
  splitChunks?: SplitVueChunkOptions;
};

export const PLUGIN_VUE_NAME = 'rsbuild:vue';

function assertCoreVersion(version: string): void {
  if (version.split('.')[0] === '1') {
    throw new Error(
      `"@rsbuild/plugin-vue" v2 requires "@rsbuild/core" >= 2.0. Please upgrade "@rsbuild/core" or use "@rsbuild/plugin-vue" v1.`,
    );
  }
}

export function pluginVue(options: PluginVueOptions = {}): RsbuildPlugin {
  return {
    name: PLUGIN_VUE_NAME,

    setup(api) {
      assertCoreVersion(api.context.version);

      const { test = /\.vue$/ } = options;
      const CSS_MODULES_REGEX = /\.modules?\.\w+$/i;

      api.modifyEnvironmentConfig((config, { mergeEnvironmentConfig }) => {
        const extraConfig: EnvironmentConfig = {
          source: {
            define: {
              // https://link.vuejs.org/feature-flags
              __VUE_OPTIONS_API__: true,
              __VUE_PROD_DEVTOOLS__: false,
              __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
            },
            // should transpile all scripts from Vue SFC
            include: [/\.vue.js$/],
          },
        };

        const merged = mergeEnvironmentConfig(extraConfig, config);

        // Support `<style module>`, `<style module="customName">` in Vue SFC
        if (merged.output.cssModules.auto === true) {
          merged.output.cssModules.auto = (path, query) => {
            // For Vue style block, the path might be like:
            // 1. `/path/to/Foo.vue`
            // 2. `/path/to/Foo.vue.css?query=...`
            if ((path.endsWith('.vue') || path.includes('.vue.css')) && query) {
              try {
                const params = new URLSearchParams(query);
                return params.get('type') === 'style' && params.has('module');
              } catch {
                return false;
              }
            }
            return CSS_MODULES_REGEX.test(path);
          };
        }

        return merged;
      });

      api.modifyBundlerChain((chain, { CHAIN_ID, environment, target }) => {
        chain.resolve.extensions.add('.vue');

        const userLoaderOptions = options.vueLoaderOptions ?? {};
        const compilerOptions = {
          preserveWhitespace: false,
          ...userLoaderOptions.compilerOptions,
        };
        const emitCss = environment.config.output.emitCss ?? target === 'web';
        const vueLoaderOptions = {
          // Always treat this as a client build when invoked from Rstest,
          // since tests are executed in a DOM-based environment.
          isServerBuild: api.context.callerName === 'rstest' ? false : undefined,
          // Keep non-emitting targets on the original SFC resource so CSS Modules
          // hashes match the client build during SSR hydration.
          experimentalInlineMatchResource: emitCss,
          ...userLoaderOptions,
          compilerOptions,
        };

        // TODO: Use a oneOf-based rule structure in the next major version
        chain.module
          .rule(CHAIN_ID.RULE.VUE)
          .test(test)
          .with({ type: { not: 'text' } })
          .use(CHAIN_ID.USE.VUE)
          .loader(require.resolve('rspack-vue-loader'))
          .options(vueLoaderOptions);

        chain.module
          .rule('vue-text')
          .after(CHAIN_ID.RULE.VUE)
          .test(test)
          .with({ type: 'text' })
          .type('asset/source');

        // Support for lang="postcss" and lang="pcss" in SFC
        chain.module.rule(CHAIN_ID.RULE.CSS).test(/\.(?:css|postcss|pcss)$/);

        chain
          .plugin(CHAIN_ID.PLUGIN.VUE_LOADER_PLUGIN)
          // Ensure that the VueLoaderPlugin is applied before the ReactFastRefreshPlugin
          // otherwise the VueLoaderPlugin will throw an error for `builtin:react-refresh-loader`
          .before(CHAIN_ID.PLUGIN.REACT_FAST_REFRESH)
          .use(VueLoaderPlugin);
      });

      applySplitChunksRule(api, options.splitChunks);
    },
  };
}
