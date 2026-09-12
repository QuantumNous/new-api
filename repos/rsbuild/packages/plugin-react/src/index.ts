import { createRequire } from 'node:module';
import path from 'node:path';
import {
  rspack,
  type RsbuildConfig,
  type RsbuildPlugin,
  type RsbuildPluginAPI,
  type Rspack,
} from '@rsbuild/core';
import type { PluginOptions as ReactRefreshOptions } from '@rspack/plugin-react-refresh';
import { applySplitChunksRule } from './splitChunks.js';

const require = createRequire(import.meta.url);

export type SplitReactChunkOptions = {
  /**
   * Whether to enable split chunking for React-related dependencies (e.g., react, react-dom, scheduler).
   *
   * @default true
   */
  react?: boolean;
  /**
   * Whether to enable split chunking for routing-related dependencies (e.g., react-router, react-router-dom, history).
   *
   * @default true
   */
  router?: boolean;
};

export type ReactCompilerOptions = Exclude<
  NonNullable<Rspack.SwcLoaderTransformConfig['reactCompiler']>,
  boolean
>;

export type PluginReactOptions = {
  /**
   * Configure the behavior of SWC to transform React code,
   * the same as SWC's [jsc.transform.react](https://swc.rs/docs/configuration/compilation#jsctransformreact).
   */
  swcReactOptions?: Rspack.SwcLoaderTransformConfig['react'];
  /**
   * Enable or configure React Compiler via `builtin:swc-loader`,
   * the same as Rspack's `jsc.transform.reactCompiler` option.
   *
   * @see https://rspack.rs/guide/tech/react#using-builtinswc-loader
   */
  reactCompiler?: Rspack.SwcLoaderTransformConfig['reactCompiler'];
  /**
   * Configuration for chunk splitting of React-related dependencies when `chunkSplit.strategy`
   * is set to `split-by-experience`.
   * @default true
   */
  splitChunks?: boolean | SplitReactChunkOptions;
  /**
   * When set to `true`, enables the React Profiler for performance analysis in production builds.
   * @default false
   */
  enableProfiler?: boolean;
  /**
   * Options passed to `@rspack/plugin-react-refresh`
   * @default
   * {
   *   include: [/\.(?:js|jsx|mjs|cjs|ts|tsx|mts|cts)$/],
   *   exclude: [/[\\/]node_modules[\\/]/],
   *   resourceQuery: { not: /^\?raw$/ },
   * }
   * @see https://rspack.rs/guide/tech/react#rspackplugin-react-refresh
   */
  reactRefreshOptions?: ReactRefreshOptions;
  /**
   * Whether to enable React Fast Refresh in development mode.
   * @default true
   */
  fastRefresh?: boolean;
};

export const PLUGIN_REACT_NAME = 'rsbuild:react';

function assertCoreVersion(version: string): void {
  if (version.split('.')[0] === '1') {
    throw new Error(
      `"@rsbuild/plugin-react" v2 requires "@rsbuild/core" >= 2.0. Please upgrade "@rsbuild/core" or use "@rsbuild/plugin-react" v1.`,
    );
  }
}

function assertReactCompilerVersion(): void {
  const [majorVersion, minorVersion] = rspack.rspackVersion.split('.');
  const major = Number(majorVersion);
  const minor = Number(minorVersion);

  if (major < 2 || (major === 2 && minor < 1)) {
    throw new Error(
      `"@rsbuild/plugin-react" requires "@rspack/core" >= 2.1.0 to use the "reactCompiler" option, but found ${rspack.rspackVersion}.`,
    );
  }
}

function applyReactProfiler(api: RsbuildPluginAPI): void {
  api.modifyEnvironmentConfig((config, { mergeEnvironmentConfig }) => {
    if (config.mode !== 'production') {
      return;
    }

    const enableProfilerConfig: RsbuildConfig = {
      output: {
        minify: {
          jsOptions: {
            minimizerOptions: {
              // Need to keep classnames and function names like Components for debugging purposes.
              mangle: {
                keep_classnames: true,
                keep_fnames: true,
              },
            },
          },
        },
      },
    };
    return mergeEnvironmentConfig(config, enableProfilerConfig);
  });

  // react-dom/client was introduced in React 18
  let hasReactDomClientCache: boolean | undefined;
  const hasReactDomClient = () => {
    if (hasReactDomClientCache !== undefined) {
      return hasReactDomClientCache;
    }

    try {
      require.resolve('react-dom/client', {
        paths: [api.context.rootPath],
      });
      hasReactDomClientCache = true;
    } catch {
      hasReactDomClientCache = false;
    }

    return hasReactDomClientCache;
  };

  api.modifyBundlerChain((chain, { isProd }) => {
    if (!isProd) {
      return;
    }

    // Replace react-dom with the profiling version.
    // For React 18+, we need to replace `react-dom/client` with `react-dom/profiling`.
    // Reference: https://gist.github.com/bvaughn/25e6233aeb1b4f0cdb8d8366e54a3977
    chain.resolve.alias.set(
      hasReactDomClient() ? 'react-dom/client$' : 'react-dom$',
      'react-dom/profiling',
    );
    chain.resolve.alias.set('scheduler/tracing', 'scheduler/tracing-profiling');
  });
}

export const pluginReact = (options: PluginReactOptions = {}): RsbuildPlugin => ({
  name: PLUGIN_REACT_NAME,

  setup(api) {
    assertCoreVersion(api.context.version);

    const defaultOptions = {
      fastRefresh: true,
      splitChunks: true,
      enableProfiler: false,
    } satisfies PluginReactOptions;

    const finalOptions = {
      ...defaultOptions,
      ...options,
    };

    if (finalOptions.reactCompiler !== undefined) {
      assertReactCompilerVersion();
    }

    const reactRefreshPath = finalOptions.fastRefresh ? require.resolve('react-refresh') : '';

    api.modifyEnvironmentConfig((config, { mergeEnvironmentConfig }) => {
      const isDev = config.mode === 'development';
      const usingHMR = isDev && config.dev.hmr && config.output.target === 'web';

      const reactOptions: Rspack.SwcLoaderTransformConfig['react'] = {
        development: isDev,
        refresh: usingHMR && finalOptions.fastRefresh,
        runtime: 'automatic',
        ...finalOptions.swcReactOptions,
      };
      const transformOptions: Rspack.SwcLoaderTransformConfig = {
        react: reactOptions,
      };

      if (finalOptions.reactCompiler !== undefined) {
        transformOptions.reactCompiler = finalOptions.reactCompiler;
      }

      return mergeEnvironmentConfig(
        {
          tools: {
            swc: {
              jsc: {
                transform: transformOptions,
              },
            },
          },
        },
        config,
      );
    });

    if (finalOptions.swcReactOptions?.runtime === 'preserve') {
      api.modifyBundlerChain((chain) => {
        chain.module.parser.merge({
          javascript: {
            jsx: true,
          },
        });
      });
    }

    api.modifyBundlerChain(async (chain, { CHAIN_ID, environment, isDev, target }) => {
      const { config } = environment;
      const usingHMR = isDev && config.dev.hmr && target === 'web';
      if (!usingHMR || !finalOptions.fastRefresh) {
        return;
      }

      chain.resolve.alias.set('react-refresh', path.dirname(reactRefreshPath));

      const { ReactRefreshRspackPlugin } = await import('@rspack/plugin-react-refresh');

      const jsRule = chain.module.rules.get(CHAIN_ID.RULE.JS);

      chain.plugin(CHAIN_ID.PLUGIN.REACT_FAST_REFRESH).use(ReactRefreshRspackPlugin, [
        {
          test: jsRule.get('test'),
          include: jsRule.include.values(),
          exclude: jsRule.exclude.values(),
          resourceQuery: { not: /^\?raw$/ },
          ...finalOptions.reactRefreshOptions,
        },
      ]);
    });

    applySplitChunksRule(api, finalOptions.splitChunks);

    if (finalOptions.enableProfiler) {
      applyReactProfiler(api);
    }
  },
});
