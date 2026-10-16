import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { EnvironmentConfig, RsbuildPlugin } from '@rsbuild/core';
import type { CompileOptions } from 'svelte/compiler';
import { sveltePreprocess } from 'svelte-preprocess';

const require = createRequire(import.meta.url);

export type AutoPreprocessOptions = NonNullable<Parameters<typeof sveltePreprocess>[0]>;

export interface SvelteLoaderOptions {
  compilerOptions?: Omit<CompileOptions, 'filename' | 'format' | 'generate'>;
  /**
   * Extra HMR options, the defaults are completely fine\
   * You can safely omit hotOptions altogether
   */
  hotOptions?: {
    /** Preserve local component state */
    preserveLocalState?: boolean;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export type PluginSvelteOptions = {
  /**
   * The options of svelte-loader
   * @see https://github.com/sveltejs/svelte-loader
   */
  svelteLoaderOptions?: SvelteLoaderOptions;
  /**
   * The options of svelte-preprocess.
   * @see https://github.com/sveltejs/svelte-preprocess
   */
  preprocessOptions?: AutoPreprocessOptions;
};

export const PLUGIN_SVELTE_NAME = 'rsbuild:svelte';

const validateSvelteVersion = (rootPath: string) => {
  let pkgPath: string;

  try {
    // Resolve `svelte` package path from the project directory
    pkgPath = require.resolve('svelte/package.json', {
      paths: [rootPath],
    });
  } catch (err) {
    throw new Error(
      'Cannot resolve `svelte` package under the project directory, did you forget to install it?',
      { cause: err },
    );
  }

  const { version } = JSON.parse(readFileSync(pkgPath, 'utf-8')) as {
    version?: string;
  };
  const majorVersion = version ? Number(version.split('.')[0]) : 0;
  if (!(majorVersion >= 5)) {
    throw new Error(
      `"@rsbuild/plugin-svelte" requires svelte >= 5.0.0, but found ${version || 'unknown'}.`,
    );
  }
};

export function pluginSvelte(options: PluginSvelteOptions = {}): RsbuildPlugin {
  return {
    name: PLUGIN_SVELTE_NAME,

    setup(api) {
      validateSvelteVersion(api.context.rootPath);

      api.modifyEnvironmentConfig((config, { mergeEnvironmentConfig }) => {
        const extraConfig: EnvironmentConfig = {
          source: {
            // transpile the Svelte package to downgrade the syntax
            include: [/node_modules[\\/]svelte[\\/]/],
          },
        };

        return mergeEnvironmentConfig(extraConfig, config);
      });

      api.modifyBundlerChain((chain, { CHAIN_ID, environment, isDev, isProd }) => {
        const environmentConfig = environment.config;

        chain.resolve.extensions.add('.svelte');
        chain.resolve.mainFields.add('svelte').add('...');
        chain.resolve.conditionNames.add('svelte').add('...');

        const loaderPath = require.resolve('svelte-loader');

        // We need to set an alias from `svelte-loader` to its realpath.
        // Because with `emitCss` option on, the loader generates css
        // imports with inline loader reference like `!svelte-loader...`,
        // which would cause the bundler failed to resolve the loader.
        // See https://github.com/sveltejs/svelte-loader/blob/344f00744b06a98ff5ee7e7a04d5e04ac496988c/index.js#L128
        chain.resolveLoader.alias.set('svelte-loader', loaderPath);

        const userLoaderOptions = options.svelteLoaderOptions ?? {};
        const svelteLoaderOptions = {
          preprocess: sveltePreprocess(options.preprocessOptions),
          // NOTE emitCss: true is currently not supported with HMR
          // See https://github.com/web-infra-dev/rsbuild/issues/2744
          emitCss: isProd && !environmentConfig.output.injectStyles,
          hotReload: isDev && environmentConfig.dev.hmr,
          ...userLoaderOptions,
          compilerOptions: {
            dev: isDev,
            ...userLoaderOptions.compilerOptions,
          },
        };

        const jsRule = chain.module.rules.get(CHAIN_ID.RULE.JS);
        const jsMainRule = jsRule.oneOfs.get(CHAIN_ID.ONE_OF.JS_MAIN);
        const swcUse = jsMainRule.uses.get(CHAIN_ID.USE.SWC);

        // TODO: Use a oneOf-based rule structure in the next major version.
        const svelteRule = chain.module
          .rule(CHAIN_ID.RULE.SVELTE)
          .test(/\.svelte$/)
          .with({ type: { not: 'text' } });

        svelteRule
          .use(CHAIN_ID.USE.SWC)
          .loader(swcUse.get('loader'))
          .options(swcUse.get('options'));

        svelteRule.use(CHAIN_ID.USE.SVELTE).loader(loaderPath).options(svelteLoaderOptions).end();

        chain.module
          .rule('svelte-text')
          .after(CHAIN_ID.RULE.SVELTE)
          .test(/\.svelte$/)
          .with({ type: 'text' })
          .type('asset/source');

        const regexp = /\.(?:svelte\.js|svelte\.ts)$/;

        jsRule.exclude.add(regexp);

        chain.module
          .rule('svelte-js')
          .test(regexp)
          .with({ type: { not: 'text' } })
          .use(CHAIN_ID.USE.SVELTE)
          .loader(loaderPath)
          .options(svelteLoaderOptions)
          .end()
          .use(CHAIN_ID.USE.SWC)
          .loader(swcUse.get('loader'))
          .options(swcUse.get('options'));

        chain.module
          .rule('svelte-js-text')
          .after('svelte-js')
          .test(regexp)
          .with({ type: 'text' })
          .type('asset/source');
      });
    },
  };
}
