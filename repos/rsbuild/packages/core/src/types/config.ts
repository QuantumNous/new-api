import type { IncomingMessage, ServerResponse } from 'node:http';
import type { SecureServerSessionOptions } from 'node:http2';
import type { ServerOptions as HttpsServerOptions } from 'node:https';
import type { URL } from 'node:url';
import type {
  CopyRspackPluginOptions,
  DefinePluginOptions,
  Externals,
  LightningCssMinimizerRspackPluginOptions,
  ModuleFederationPluginOptions,
  RuleSetCondition,
  SwcJsMinimizerRspackPluginOptions,
  SwcLoaderOptions,
} from '@rspack/core';
import type { ChokidarOptions } from 'chokidar';
import type Cors from 'cors';
import type { Options as HttpProxyOptions, Filter as ProxyFilter } from 'http-proxy-middleware';
import type { RspackChain } from 'rspack-chain';
import type { FileDescriptor } from 'rspack-manifest-plugin';
import type { HotSend, RsbuildDevServer } from '../server/devServer';
import type { RsbuildPreviewServer } from '../server/previewServer';
import type { Logger } from '../logger';
import type {
  EnvironmentContext,
  ModifyBundlerChainUtils,
  ModifyChainUtils,
  Routes,
} from './hooks';
import type { RsbuildPlugins } from './plugin';
import type { RsbuildEntry, RsbuildMode, RsbuildTarget } from './rsbuild';
import type { Rspack, RspackRule } from './rspack';
import type {
  Connect,
  CSSExtractOptions,
  CSSLoaderModulesOptions,
  CSSLoaderOptions,
  HtmlRspackPlugin,
  LoosePostCSSPlugin,
  PostCSSLoaderOptions,
  StyleLoaderOptions,
} from './thirdParty';
import type {
  ConfigChain,
  ConfigChainAsyncWithContext,
  ConfigChainWithContext,
  LiteralUnion,
  MaybePromise,
  OneOrMany,
  Optional,
  TwoLevelReadonly,
} from './utils';

export type ToolsSwcConfig = ConfigChain<SwcLoaderOptions>;

export type ToolsBundlerChainConfig = OneOrMany<
  (chain: RspackChain, utils: ModifyBundlerChainUtils) => MaybePromise<void>
>;

export type ToolsPostCSSContext = {
  addPlugins: (
    plugins: LoosePostCSSPlugin | LoosePostCSSPlugin[],
    options?: {
      /**
       * Controls where the plugin is placed relative to the existing PostCSS plugins.
       * - `pre`: Insert the plugin before all existing plugins.
       * - `post`: Insert the plugin after all existing plugins.
       * @default `post`
       */
      order?: 'pre' | 'post';
    },
  ) => void;
};

export type ToolsPostCSSLoaderConfig = ConfigChainWithContext<
  PostCSSLoaderOptions,
  ToolsPostCSSContext
>;

export type ToolsCSSLoaderConfig = ConfigChain<CSSLoaderOptions>;

export type ToolsStyleLoaderConfig = ConfigChain<StyleLoaderOptions>;

export type ToolsHtmlPluginConfig = ConfigChainWithContext<
  HtmlRspackPlugin.Options,
  {
    entryName: string;
    entryValue: (string | string[] | Rspack.EntryDescription)[];
  }
>;

// equivalent to import('rspack-merge').merge
export type RspackMerge = (
  firstConfiguration: Rspack.Configuration | Rspack.Configuration[],
  ...configurations: Rspack.Configuration[]
) => Rspack.Configuration;

export type ModifyRspackConfigUtils = ModifyChainUtils & {
  addRules: (rules: OneOrMany<RspackRule>) => void;
  appendRules: (rules: OneOrMany<RspackRule>) => void;
  prependPlugins: (plugins: OneOrMany<Rspack.Plugin>) => void;
  appendPlugins: (plugins: OneOrMany<Rspack.Plugin>) => void;
  removePlugin: (pluginName: string) => void;
  mergeConfig: RspackMerge;
};

/**
 * Narrow the type of Rspack.Configuration to make it easier
 * to use `tools.rspack` function. These properties are set
 * by Rsbuild by default so they are non-nullable.
 *
 * - With `Rspack.Configuration`, the `plugins` property is nullable:
 *
 * ```js
 * tools: {
 *   rspack(config) {
 *     if (!config.plugins) {
 *       config.plugins = [];
 *     }
 *     config.plugins.push(new SomePlugin());
 *   }
 * }
 * ```
 *
 * - With `NarrowedRspackConfig`, the `plugins` property is non-nullable:
 *
 * ```js
 * tools: {
 *   rspack(config) {
 *     config.plugins.push(new SomePlugin());
 *   }
 * }
 * ```
 */
export type NarrowedRspackConfig = Omit<
  Rspack.Configuration,
  'plugins' | 'module' | 'resolve' | 'output'
> & {
  /**
   * Plugins to use during compilation.
   */
  plugins: Rspack.Plugin[];
  /**
   * Options for module configuration.
   */
  module: NonNullable<Rspack.Configuration['module']>;
  /**
   * Options for resolving modules.
   */
  resolve: NonNullable<Rspack.Configuration['resolve']>;
  /**
   * Configuration for the output of the compilation.
   */
  output: NonNullable<Rspack.Configuration['output']>;
};

export type ToolsRspackConfig = OneOrMany<
  | Rspack.Configuration
  | ((
      config: NarrowedRspackConfig,
      ctx: ModifyRspackConfigUtils,
    ) => MaybePromise<Rspack.Configuration | void>)
>;

export interface ToolsConfig {
  /**
   * Configure bundler config base on [rspack-chain](https://github.com/rstackjs/rspack-chain)
   */
  bundlerChain?: ToolsBundlerChainConfig;
  /**
   * Modify the options of [css-loader](https://github.com/webpack/css-loader).
   */
  cssLoader?: ToolsCSSLoaderConfig;
  /**
   * Modify the options of [postcss-loader](https://github.com/webpack/postcss-loader).
   */
  postcss?: ToolsPostCSSLoaderConfig;
  /**
   * Modify the options of [style-loader](https://github.com/webpack/style-loader).
   */
  styleLoader?: ToolsStyleLoaderConfig;
  /**
   * Configure the html-rspack-plugin.
   */
  htmlPlugin?: boolean | ToolsHtmlPluginConfig;
  /**
   * Configure the `builtin:swc-loader` of Rspack.
   */
  swc?: ToolsSwcConfig;
  /**
   * Configure the `builtin:lightningcss-loader` of Rspack.
   */
  lightningcssLoader?: boolean | ConfigChain<Rspack.LightningcssLoaderOptions>;
  /**
   * Modify the options of [CssExtractRspackPlugin](https://rspack.rs/plugins/rspack/css-extract-rspack-plugin).
   */
  cssExtract?: CSSExtractOptions;
  /**
   * Configure Rspack.
   */
  rspack?: ToolsRspackConfig;
}

export type NormalizedToolsConfig = ToolsConfig & {
  cssExtract: Required<CSSExtractOptions>;
};

export type Alias = Record<string, string | false | (string | false)[]>;

export type AliasStrategy = 'prefer-tsconfig' | 'prefer-alias';

export type Decorators = {
  /**
   * Specify the version of decorators to use.
   * @default '2023-11'
   */
  version?:
    | 'legacy' // stage 1
    | '2022-03' // stage 3
    | '2023-11'; // stage 3
};

export interface SourceConfig {
  /**
   * Include additional files that should be treated as static assets.
   * @default undefined
   */
  assetsInclude?: Rspack.RuleSetCondition;
  /**
   * Specify additional JavaScript files that need to be compiled by SWC.
   * Through the `source.include` config, you can specify directories or modules
   * that need to be compiled by Rsbuild. The usage of `source.include` is
   * consistent with [rules[].include](https://rspack.rs/config/module-rules#rulesinclude)
   * in Rspack, which supports passing in strings or regular expressions to match
   * the module path.
   * @default
   * [
   *   { and: [rootPath, { not: /[\\/]node_modules[\\/]/ }], },
   *   /\.(?:ts|tsx|jsx|mts|cts)$/,
   * ];
   */
  include?: RuleSetCondition[];
  /**
   * Set the entry modules for building.
   *
   * The value of `source.entry` is an object, the key is the entry name, and the
   * value is the path of the entry module or a description object.
   *
   * If the value is a path, it can be an absolute path or a relative path, the
   * relative path will be resolved based on `root`.
   *
   * @default
   * {
   *   // Rsbuild also supports other suffixes by default, such as ts,
   *   // tsx, jsx, mts, cts, mjs, cjs
   *   index: './src/index.js',
   * }
   */
  entry?: RsbuildEntry;
  /**
   * Exclude JavaScript or TypeScript files that do not need to be compiled by SWC.
   */
  exclude?: RuleSetCondition[];
  /**
   * Add a script before the entry file of each page.
   * This script will be executed before the page code.
   * It can be used to execute global logics, such as polyfill injection.
   */
  preEntry?: string | string[];
  /**
   * Replaces variables in your code with other values or expressions at compile time.
   * This is useful for enabling different behavior between development and production builds.
   */
  define?: DefinePluginOptions;
  /**
   * Configuring decorators syntax.
   */
  decorators?: Decorators;
  /**
   * Used to import the code and style of the component library on demand.
   */
  transformImport?: TransformImportFn | (TransformImport | TransformImportFn)[];
  /**
   * Configure a custom tsconfig.json file path to use, can be a relative or absolute path.
   * @default 'tsconfig.json'
   */
  tsconfigPath?: string;
}

export type TransformImport = {
  libraryName: string;
  libraryDirectory?: string;
  customName?: string;
  customStyleName?: string;
  style?: string | boolean;
  styleLibraryDirectory?: string;
  camelToDashComponentName?: boolean;
  transformToDefaultImport?: boolean;
  ignoreEsComponent?: string[];
  ignoreStyleComponent?: string[];
};

type TransformImportFn = (imports: TransformImport[]) => TransformImport[] | void;

export interface NormalizedSourceConfig extends SourceConfig {
  define: DefinePluginOptions;
  preEntry: string[];
  decorators: Required<Decorators>;
}

export type HtmlFallback = false | 'index';

export type ProxyBypass = (
  req: IncomingMessage,
  res: ServerResponse,
  proxyOptions: ProxyOptions,
) => MaybePromise<string | undefined | null | boolean>;

export type { ProxyFilter };

export type ProxyOptions = HttpProxyOptions & {
  /**
   * Use the `bypass` function to skip the proxy.
   * Inside the function, you have access to the request, response, and proxy options.
   * - Return `null` or `undefined` to continue processing the request with proxy.
   * - Return `true` to skip the proxy and continue processing the request.
   * - Return `false` to produce a 404 error for the request.
   * - Return a specific path to replace the original request path.
   * - Return a Promise to handle the request asynchronously.
   */
  bypass?: ProxyBypass;
};

export type ProxyConfig = Record<string, string | ProxyOptions> | ProxyOptions[];

export type HistoryApiFallbackContext = {
  match: RegExpMatchArray;
  parsedUrl: URL;
  request: IncomingMessage;
};

export type HistoryApiFallbackTo = string | ((context: HistoryApiFallbackContext) => string);

export type HistoryApiFallbackOptions = {
  /**
   * Specifies the default HTML file to return when the History API fallback is enabled.
   * For example, if you set `historyApiFallback.index` to `main.html`, the server will
   * automatically serve `main.html` as the fallback page when users access any unmatched
   * routes.
   * @default 'index.html'
   */
  index?: string;
  /**
   * Override the default `Accepts:` headers that are queried when matching HTML content
   * requests.
   * @default ['text/html', '*\/*']
   */
  htmlAcceptHeaders?: string[];
  /**
   * By default, requests containing a dot (`.`) in the path are treated as direct file
   * requests and are not redirected. Setting `disableDotRule` to `true` will disable this
   * behavior and allow such requests to be redirected as well.
   * @default false
   */
  disableDotRule?: boolean;
  /**
   * `rewrites` lets you customize how request paths are mapped to HTML files when
   * a History API fallback occurs. These rules only apply when no static asset matches
   * the request, meaning it has entered the fallback stage. Each rule is evaluated in
   * order until a match is found and executed.
   */
  rewrites?: {
    from: RegExp;
    to: HistoryApiFallbackTo;
  }[];
};

export type PrintUrlsParams = {
  urls: string[];
  port: number;
  routes: Routes;
  protocol: string;
};

export type PrintUrlsOptions = {
  /**
   * The maximum number of entry URLs to print.
   * Set to `0` to print only the server URL without entry routes.
   * @default 10
   */
  maxRoutes?: number;
};

export type PrintUrls =
  | boolean
  | PrintUrlsOptions
  | ((params: PrintUrlsParams) => (string | { url: string; label?: string })[] | void);

export type PublicDirOptions = {
  /**
   * The name of the public directory, can be set as a relative path or an absolute path.
   * @default 'public'
   */
  name?: string;
  /**
   * Whether to copy files from the public directory to the dist directory on production build.
   * - `true`: copy files
   * - `false`: do not copy files
   * - `'auto'`: if `output.target` is not `'node'`, copy files, otherwise do not copy
   * @default 'auto'
   */
  copyOnBuild?: boolean | 'auto';
  /**
   * whether to watch the public directory and reload the page when the files change
   * @default false
   */
  watch?: boolean;
  /**
   * Glob patterns for files or directories to ignore when copying the public directory
   * during production builds.
   * @default []
   */
  ignore?: string[];
};

export type PublicDir = false | PublicDirOptions | PublicDirOptions[];

/**
 * The options for `server.compress`.
 */
export type CompressOptions = {
  /**
   * A function that determines whether a response should be compressed.
   * @param req - The incoming HTTP request
   * @param res - The outgoing HTTP response
   * @returns `true` to compress the response, `false` to skip compression
   */
  filter?: (req: IncomingMessage, res: ServerResponse) => boolean;
  /**
   * The level of zlib compression to apply to responses.
   * A higher level will result in better compression, but will take longer to complete.
   * A lower level will result in less compression, but will be much faster.
   * This is an integer in the range of 0 (no compression) to 9 (maximum compression).
   * @default
   * - 1 (fastest) for dev server (also known as `zlib.constants.Z_BEST_SPEED`)
   * - 6 for preview server (also known as `zlib.constants.Z_DEFAULT_COMPRESSION`)
   */
  level?: number;
};

export interface ServerConfig {
  /**
   * Configure the base path of the server.
   * @default '/'
   */
  base?: string;
  /**
   * Whether to enable gzip compression for served static assets.
   * Pass an object to customize the compression behavior.
   * @default true
   */
  compress?: boolean | CompressOptions;
  /**
   * Serving static files from the directory
   * @default { name: 'public', copyOnBuild: 'auto', watch: false }
   */
  publicDir?: PublicDir;
  /**
   * Specify a port number for Rsbuild server to listen.
   * @default 3000
   */
  port?: number;
  /**
   * Configure HTTPS options to enable HTTPS server.
   * When enabled, HTTP server will be disabled.
   * @default undefined
   */
  https?: HttpsServerOptions | SecureServerSessionOptions;
  /**
   * Specify the host that the Rsbuild server listens to.
   * - `string`: specify a hostname or IP address to listen on.
   * - `true`: equals to `0.0.0.0`, listen on all interfaces.
   * - `false`: equals to `localhost`
   * @default 'localhost'
   */
  host?: string | boolean;
  /**
   * Adds headers to all responses.
   */
  headers?: Record<string, string | string[]>;
  /**
   * Whether to enable HTML fallback.
   * @default 'index'
   */
  htmlFallback?: HtmlFallback;
  /**
   * Used to support routing based on the history API.
   * When a user visits a path that does not exist, it will automatically
   * return a specified HTML file to avoid a 404 error.
   * @default false
   */
  historyApiFallback?: boolean | HistoryApiFallbackOptions;
  /**
   * Set the page URL to open when the server starts.
   * @default false
   */
  open?:
    | boolean
    | string
    | string[]
    | {
        target?: string | string[];
        before?: () => Promise<void> | void;
      };
  /**
   * Configure CORS for the dev server or preview server.
   * - object: enable CORS with the specified options.
   * - true: enable CORS with default options (allow all origins, not recommended).
   * - false: disable CORS.
   * @default
   * ```js
   * { origin: defaultAllowedOrigins }
   * ```
   * where `defaultAllowedOrigins` includes:
   * - `localhost`
   * - `127.0.0.1`
   * - `[::1]`
   *
   * @link https://github.com/expressjs/cors
   */
  cors?: boolean | Cors.CorsOptions;
  /**
   * Configure proxy rules for the dev server or preview server to proxy requests to
   * the specified service.
   */
  proxy?: ProxyConfig;
  /**
   * Whether to throw an error when the port is occupied.
   * @default false
   */
  strictPort?: boolean;
  /**
   * Controls whether and how server URLs are printed when the server starts.
   * @default true
   */
  printUrls?: PrintUrls;
  /**
   * Whether to create Rsbuild's server in middleware mode, which is useful for
   * integrating with other servers.
   * @default false
   */
  middlewareMode?: boolean;
  /**
   * Run setup logic when the Rsbuild dev server or preview server starts,
   * such as registering custom middleware or running pre-start tasks.
   *
   * When `server.setup` is called, Rsbuild built-in middlewares are not registered yet,
   * so middlewares you add run earlier than built-ins.
   *
   * `server.setup` can return a callback function. After built-in middlewares are registered,
   * Rsbuild will execute that callback. Middlewares registered in the callback run later than built-ins.
   *
   * @default undefined
   */
  setup?: ServerSetupFn | ServerSetupFn[];
}

export type NormalizedServerConfig = {
  host: string;
  publicDir: Required<PublicDirOptions>[];
} & Omit<
  Optional<Required<ServerConfig>, 'headers' | 'https' | 'historyApiFallback' | 'proxy' | 'setup'>,
  'host' | 'publicDir'
>;

export type ServerSetupContext = {
  /**
   * Environment contexts of all environments.
   */
  environments: Record<string, EnvironmentContext>;
} & (
  | {
      /**
       * Action type of current server.
       */
      action: 'dev';
      /**
       * Dev server instance, only available in dev mode.
       */
      server: RsbuildDevServer;
    }
  | {
      /**
       * Action type of current server.
       */
      action: 'preview';
      /**
       * Preview server instance, only available in preview mode.
       */
      server: RsbuildPreviewServer;
    }
);

/**
 * Server setup function.
 * Return a callback to run after built-in middlewares are registered.
 */
export type ServerSetupFn = (
  context: ServerSetupContext,
) => MaybePromise<(() => MaybePromise<void>) | void>;

export type SriAlgorithm = 'sha256' | 'sha384' | 'sha512';

export type SriOptions = {
  /**
   * Specifies the algorithm used to compute the integrity hash.
   * @default 'sha384'
   */
  algorithm?: SriAlgorithm | SriAlgorithm[];
  /**
   * Whether to enable SRI.
   * `'auto'` means it's enabled in production mode and disabled in development mode.
   * @default false
   */
  enable?: boolean | 'auto';
};

export interface SecurityConfig {
  /**
   * Adding a `nonce` attribute to the scripts resources introduced for HTML. This allows
   * the browser to determine whether the script can be executed when it parses inline
   * scripts with matching nonce values.
   */
  nonce?: string;
  /**
   * Adding an integrity attribute (`integrity`) to sub-resources introduced by HTML
   * allows the browser to verify the integrity of the introduced resource, thus preventing
   * tampering with the downloaded resource.
   */
  sri?: SriOptions;
}

export type NormalizedSecurityConfig = Required<SecurityConfig>;

export type ConsoleType = 'log' | 'info' | 'warn' | 'error' | 'table' | 'group';

export type BuildCacheOptions = {
  /**
   * The output directory of the cache files.
   * @default 'node_modules/.cache'
   */
  cacheDirectory?: string;
  /**
   * Add additional cache digests, the previous build cache will be invalidated
   * when any value in the array changes.
   * @default undefined
   */
  cacheDigest?: (string | undefined)[];
  /**
   * An array of files containing build dependencies.
   * Rspack will use the hash of each of these files to invalidate the persistent cache.
   */
  buildDependencies?: string[];
};

export type PrintFileSizeAsset = {
  /**
   * The name of the asset.
   * @example 'index.html', 'static/js/index.[hash].js'
   */
  name: string;
  /**
   * The size of the asset in bytes.
   */
  size: number;
};

export type PrintFileSizeOptions = {
  /**
   * Whether to print the total size of all static assets, or a function to generate custom total output.
   * @default true
   */
  total?:
    | boolean
    | ((params: {
        environmentName: string;
        distPath: string;
        assets: PrintFileSizeAsset[];
        totalSize: number;
        totalGzipSize: number;
      }) => string);
  /**
   * Whether to print the size of each static asset.
   * @default true
   */
  detail?: boolean;
  /**
   * Whether to print the gzip-compressed size of each static asset.
   * Disable this option can save some gzip computation time for large projects.
   * @default true
   */
  compressed?: boolean;
  /**
   * A filter function to determine which static assets to print.
   * If returned `false`, the static asset will be excluded and not included in the
   * total size or detailed size.
   * @default undefined
   */
  include?: (asset: PrintFileSizeAsset) => boolean;
  /**
   * A filter function to exclude static assets from the total size or detailed size.
   * If both `include` and `exclude` are set, `exclude` will take precedence.
   * @default (asset) => /\.(?:map|LICENSE\.txt|d\.(?:ts|mts|cts))$/.test(asset.name)
   */
  exclude?: (asset: PrintFileSizeAsset) => boolean;
  /**
   * Controls whether file size differences are displayed relative to the previous build.
   * When this option is enabled, Rsbuild records a snapshot of all output file sizes after
   * each build. On subsequent builds, Rsbuild compares the current sizes against the previous
   * snapshot and shows the change inline in parentheses.
   * @default false
   */
  diff?: boolean;
};

export interface PreconnectOption {
  /**
   * The URL of the resource to preconnect to.
   */
  href: string;
  /**
   * Whether to add `crossorigin` attribute to the `<link>` element.
   */
  crossorigin?: boolean;
}

export type Preconnect = (string | PreconnectOption)[];

export type DnsPrefetch = string[];

export type ResourceHintsIncludeType = 'async-chunks' | 'initial' | 'all-assets' | 'all-chunks';

export type ResourceHintsFilterFn = (filename: string) => boolean;

export type ResourceHintsFilter = OneOrMany<string | RegExp | ResourceHintsFilterFn>;

export interface ResourceHintsOptions {
  /**
   * Specifies which types of resources will be included.
   * - `async-chunks`: Includes all async resources on the current page, such as async JS
   * chunks, and its associated CSS, images, and fonts.
   * - `initial`: Includes all non-async resources on the current page.
   * - `all-chunks`: Includes all async and non-async resources on the current page.
   * - `all-assets`: Includes all resources from all pages.
   * @default 'async-chunks'
   */
  type?: ResourceHintsIncludeType;
  /**
   * An extra filter to determine which resources to include.
   */
  include?: ResourceHintsFilter;
  /**
   * An extra filter to determine which resources to exclude.
   *
   * @default /\.(?:webmanifest|pdf|txt)$/i
   */
  exclude?: ResourceHintsFilter;
  /**
   * Whether to dedupe script resources that already exist in the current HTML content.
   * By default, if a resource has been added to the current HTML via a script tag, it will
   * not be preloaded additionally.
   * @default true
   */
  dedupe?: boolean;
}

export type PreloadOptions = ResourceHintsOptions;

export type PrefetchOptions = Omit<ResourceHintsOptions, 'dedupe'>;

export interface PerformanceConfig {
  /**
   * Whether to remove `console.[methodName]` in production build.
   * @default false
   */
  removeConsole?: boolean | ConsoleType[];

  /**
   * To enable or configure persistent build cache.
   * @default false
   */
  buildCache?: BuildCacheOptions | boolean;

  /**
   * Whether to print the file sizes after production build.
   * @default true
   */
  printFileSize?: PrintFileSizeOptions | boolean;

  /**
   * Configure the chunk splitting strategy.
   * @deprecated Use `splitChunks` instead.
   */
  chunkSplit?: ChunkSplit;

  /**
   * Used to control resource `Preconnect`.
   *
   * Specifies that the user agent should preemptively connect to the target resource's origin.
   */
  preconnect?: Preconnect;

  /**
   * Used to control resource `DnsPrefetch`.
   *
   * Specifies that the user agent should preemptively perform DNS resolution for the target
   * resource's origin.
   */
  dnsPrefetch?: DnsPrefetch;

  /**
   * Inject the `<link rel="preload">` tags for the static assets generated by Rsbuild.
   *
   * `performance.preload` can be set to an object or an array of objects to specify the options.
   *
   * When `performance.preload` is set to `true`, Rsbuild will use the following default
   * options to preload resources. This means preloading all async resources on the current
   * page, including async JS and its associated CSS, image, and font resources.
   *
   * ```js
   * const defaultOptions = {
   *   type: 'async-chunks',
   * };
   * ```
   * @default undefined
   */
  preload?: true | OneOrMany<PreloadOptions>;

  /**
   * Inject the `<link rel="prefetch">` tags for the static assets generated by Rsbuild.
   *
   * `performance.prefetch` can be set to an object or an array of objects to specify the options.
   *
   * When `performance.prefetch` is set to `true`, Rsbuild will use the following default
   * options to prefetch resources. This means prefetching all async resources on the current
   * page, including async JS and its associated CSS, image, and font resources.
   *
   * ```js
   * const defaultOptions = {
   *   type: 'async-chunks',
   * };
   * ```
   * @default undefined
   */
  prefetch?: true | OneOrMany<PrefetchOptions>;
}

export interface NormalizedPerformanceConfig extends PerformanceConfig {
  printFileSize: PrintFileSizeOptions | boolean;
}

export type SplitChunks = Rspack.OptimizationSplitChunksOptions | false;

/**
 * Split chunks preset rules.
 * - `default`: splits polyfills when enabled and applies extra groups when using
 * framework plugins.
 * - `per-package`: splits dependencies in `node_modules` by npm package.
 * - `single-vendor`: splits all `node_modules` dependencies into one vendor chunk.
 * - `none`: disables Rsbuild preset rules.
 */
export type SplitChunksPreset = 'default' | 'single-vendor' | 'per-package' | 'none';

export type SplitChunksConfig = Rspack.OptimizationSplitChunksOptions & {
  preset?: SplitChunksPreset;
};

export type NormalizedSplitChunksConfig = SplitChunksConfig;

export type ForceSplitting = RegExp[] | Record<string, RegExp>;

export interface BaseSplitRules {
  strategy?: string;
  forceSplitting?: ForceSplitting;
  override?: SplitChunks;
}

export interface BaseChunkSplit extends BaseSplitRules {
  strategy?: 'split-by-module' | 'split-by-experience' | 'all-in-one' | 'single-vendor';
}

export interface SplitBySize extends BaseSplitRules {
  strategy: 'split-by-size';
  minSize?: number;
  maxSize?: number;
}

export interface SplitCustom extends BaseSplitRules {
  strategy: 'custom';
  splitChunks?: SplitChunks;
}

export type ChunkSplit = BaseChunkSplit | SplitBySize | SplitCustom;

export type DistPathConfig = {
  /**
   * The root directory of all files.
   * @default 'dist'
   **/
  root?: string;
  /**
   * The output directory of JavaScript files.
   * @default 'static/js'
   */
  js?: string;
  /**
   * The output directory of async JavaScript files.
   * @default 'static/js/async'
   */
  jsAsync?: string;
  /**
   * The output directory of CSS files.
   * @default 'static/css'
   */
  css?: string;
  /**
   * The output directory of async CSS files.
   * @default 'static/css/async'
   */
  cssAsync?: string;
  /**
   * The output directory of SVG images.
   * @default 'static/svg'
   */
  svg?: string;
  /**
   * The output directory of font files.
   * @default 'static/font'
   */
  font?: string;
  /**
   * The output directory of HTML files.
   * @default './'
   */
  html?: string;
  /**
   * The output directory of Wasm files.
   * @default 'static/wasm'
   */
  wasm?: string;
  /**
   * The output directory of non-SVG images.
   * @default 'static/image'
   */
  image?: string;
  /**
   * The output directory of media resources, such as videos.
   * @default 'static/media'
   */
  media?: string;
  /**
   * The output directory of assets, except for above (image, svg, font, html, wasm...)
   * @default 'static/assets'
   */
  assets?: string;
  /**
   * The output directory of favicon.
   * @default './'
   */
  favicon?: string;
};

export type FilenameConfig = {
  /**
   * The name of HTML files.
   * @default `[name].html`
   */
  html?: string;
  /**
   * The name of the JavaScript files.
   * @default
   * - dev: '[name].js'
   * - prod: '[name].[contenthash:10].js'
   */
  js?: Rspack.Filename;
  /**
   * The name of the CSS files.
   * @default
   * - dev: '[name].css'
   * - prod: '[name].[contenthash:10].css'
   */
  css?: Rspack.CssFilename;
  /**
   * The name of the SVG images.
   * @default '[name].[contenthash:10].svg'
   */
  svg?: Rspack.AssetModuleFilename;
  /**
   * The name of the font files.
   * @default '[name].[contenthash:10][ext]'
   */
  font?: Rspack.AssetModuleFilename;
  /**
   * The name of non-SVG images.
   * @default '[name].[contenthash:10][ext]'
   */
  image?: Rspack.AssetModuleFilename;
  /**
   * The name of media assets, such as video.
   * @default '[name].[contenthash:10][ext]'
   */
  media?: Rspack.AssetModuleFilename;
  /**
   * The name of Wasm files.
   * @default '[hash].module.wasm'
   */
  wasm?: Rspack.WebassemblyModuleFilename;
  /**
   * The name of other assets, except for above (image, svg, font, html, wasm...)
   * @default '[name].[contenthash:10][ext]'
   */
  assets?: Rspack.AssetModuleFilename;
};

export type FilenameHash =
  | boolean
  | string
  | {
      /**
       * Controls whether to add filename hash.
       * - `true`: JavaScript and CSS filenames include hash in production mode.
       * - `false`: Disable filename hash.
       * - `'always'`: JavaScript and CSS filenames include hash in all modes.
       * @default true
       */
      enable?: boolean | 'always';
      /**
       * The filename hash format.
       * @default 'contenthash:10'
       */
      format?: string;
    };

export type DataUriLimit = {
  /**
   * The data URI limit of the SVG image.
   * @default 4096
   */
  svg?: number;
  /**
   * The data URI limit of the font file.
   * @default 4096
   */
  font?: number;
  /**
   * The data URI limit of non-SVG images.
   * @default 4096
   */
  image?: number;
  /**
   * The data URI limit of media resources such as videos.
   * @default 4096
   */
  media?: number;
  /**
   * The data URI limit of other static assets.
   * @default 4096
   */
  assets?: number;
};

export type Charset = 'ascii' | 'utf8';

export type LegalComments = 'none' | 'inline' | 'linked';

export type NormalizedDataUriLimit = Required<DataUriLimit>;

export type Polyfill = 'usage' | 'entry' | 'off';

export type SourceMapExtractTarget = {
  /**
   * Include matched files whose existing source maps should be extracted.
   */
  include?: RuleSetCondition[];
  /**
   * Exclude matched files whose existing source maps should not be extracted.
   */
  exclude?: RuleSetCondition[];
};

export type SourceMapExtractOptions = SourceMapExtractTarget & {
  /**
   * Custom rule condition for matching files whose existing source maps should
   * be extracted.
   * @default /\.(?:js|mjs|cjs|jsx)$/
   */
  test?: RuleSetCondition;
  /**
   * Whether to extract existing source maps from matching JavaScript files.
   * @deprecated Use the flat `test`, `include`, and `exclude` fields instead.
   */
  js?: boolean | SourceMapExtractTarget;
};

export type SourceMapExtract = boolean | SourceMapExtractOptions;

export type SourceMap = {
  /**
   * The source map type for JavaScript files.
   * @default isDev ? 'cheap-module-source-map' : false
   */
  js?: Rspack.Configuration['devtool'];
  /**
   * Whether to generate source map for CSS files.
   * @default false
   */
  css?: boolean;
  /**
   * Whether to extract existing source maps from matching input files.
   * This is useful when a third-party package already ships both output files
   * and source map files.
   * @default false
   */
  extract?: SourceMapExtract;
};

export type CSSModulesLocalsConvention =
  | 'asIs'
  | 'camelCase'
  | 'camelCaseOnly'
  | 'dashes'
  | 'dashesOnly';

export type CSSModules = {
  /**
   * Allows CSS Modules to be automatically enabled based on their filenames.
   * @default true
   */
  auto?: CSSLoaderModulesOptions['auto'];
  /**
   * Allows exporting names from global class names, so you can use them via import.
   * @default false
   */
  exportGlobals?: boolean;
  /**
   * Style of exported class names.
   * @default 'camelCase'
   */
  exportLocalsConvention?: CSSModulesLocalsConvention;
  /**
   * Set the local ident name of CSS Modules.
   * @default isProd ? '[local]-[hash:base64:6]' : '[path][name]__[local]-[hash:base64:6]'
   */
  localIdentName?: string;
  /**
   * Controls the level of compilation applied to the input styles.
   * @default 'local'
   */
  mode?: CSSLoaderModulesOptions['mode'];
  /**
   * Whether to enable ES modules named export for locals.
   * @default false
   */
  namedExport?: boolean;
};

export type Minify =
  | boolean
  | {
      /**
       * Whether to enable minification for JavaScript bundles.
       * - `true`: Enabled in production mode.
       * - `false`: Disabled in all modes.
       * - `'always'`: Enabled in all modes.
       * @default true
       */
      js?: boolean | 'always';
      /**
       * Minimizer options of JavaScript, which will be passed to SWC.
       * @default {}
       */
      jsOptions?: SwcJsMinimizerRspackPluginOptions;
      /**
       * Whether to enable minification for CSS bundles.
       * - `true`: Enabled in production mode.
       * - `false`: Disabled in all modes.
       * - `'always'`: Enabled in all modes.
       * @default true
       */
      css?: boolean | 'always';
      /**
       * Minimizer options of CSS, which will be passed to LightningCSS.
       * @default inherit from `tools.lightningcssLoader` config
       */
      cssOptions?: LightningCssMinimizerRspackPluginOptions;
    };

export type InlineChunkTestFunction = (params: { size: number; name: string }) => boolean;

export type InlineChunkTest = RegExp | InlineChunkTestFunction;

export type InlineChunkConfig =
  | boolean
  | InlineChunkTest
  | { enable?: boolean | 'auto'; test: InlineChunkTest };

export type ManifestByEntry = {
  /**
   * Files that are required during the initial load of the entry.
   */
  initial?: {
    /** Initial JavaScript files for this entry. */
    js?: string[];
    /** Initial CSS files for this entry. */
    css?: string[];
  };
  /**
   * Files that may be loaded asynchronously.
   * Usually code-split chunks or lazily loaded chunks.
   */
  async?: {
    /** Async JavaScript files for this entry. */
    js?: string[];
    /** Async CSS files for this entry. */
    css?: string[];
  };
  /** HTML files generated for this entry, if any. */
  html?: string[];
  /**
   * Additional assets associated with this entry.
   * For example images、fonts、source maps and other non JS or CSS files.
   */
  assets?: string[];
};

export type ManifestData = {
  /**
   * A flat list of all emitted asset files.
   */
  allFiles: string[];
  /**
   * Maps each entry name to its associated output files.
   */
  entries: Record<string, ManifestByEntry>;
  /**
   * Subresource Integrity (SRI) hashes for emitted assets.
   * The key is the asset file path, and the value is its integrity hash.
   * This field is available only when the `security.sri` option is enabled.
   */
  integrity: Record<string, string>;
};

export type ManifestObjectConfig = {
  /**
   * The filename or path of the manifest file.
   * The manifest file will be emitted to the output directory.
   * @default 'manifest.json'
   */
  filename?: string;
  /**
   * A custom function to generate the content of the manifest file.
   */
  generate?: (params: {
    files: FileDescriptor[];
    manifestData: ManifestData;
  }) => Record<string, unknown>;
  /**
   * Allows you to filter the files included in the manifest.
   * The function receives a `file` parameter and returns `true` to keep the file,
   * or `false` to exclude it.
   * @default (file: FileDescriptor) => !file.name.endsWith('.LICENSE.txt')
   */
  filter?: (file: FileDescriptor) => boolean;
  /**
   * Controls whether the generated manifest includes the static asset prefix in file paths.
   * The prefix is taken from `dev.assetPrefix` and `output.assetPrefix`.
   * @default true
   */
  prefix?: boolean;
};

export type ManifestConfig = string | boolean | ManifestObjectConfig;

export type CleanDistPathObject = {
  /**
   * Whether to clean up all files under the output directory before the build starts.
   * @default 'auto'
   */
  enable?: boolean | 'auto';
  /**
   * Specify the files to keep in the output directory.
   * If the file's absolute path matches the regular expression in `keep`, the file
   * will not be removed.
   * @default undefined
   */
  keep?: RegExp[];
};

export type CleanDistPath = boolean | 'auto' | CleanDistPathObject;

export type AutoExternalExclude = OneOrMany<string | RegExp>;

export type AutoExternal =
  | boolean
  | {
      /**
       * Whether to automatically externalize dependencies of type `dependencies`.
       * @default true
       */
      dependencies?: boolean;
      /**
       * Whether to automatically externalize dependencies of type `optionalDependencies`.
       * @default true
       */
      optionalDependencies?: boolean;
      /**
       * Whether to automatically externalize dependencies of type `peerDependencies`.
       * @default true
       */
      peerDependencies?: boolean;
      /**
       * Whether to automatically externalize dependencies of type `devDependencies`.
       * @default false
       */
      devDependencies?: boolean;
      /**
       * Specify the package.json file path(s) used to collect dependencies.
       * Relative paths are resolved from the Rsbuild root directory.
       * @default '<root>/package.json'
       */
      packageJson?: string | string[];
      /**
       * Prevent matched packages from being automatically externalized.
       * Strings match package names exactly, and regular expressions test package names.
       * @default undefined
       */
      exclude?: AutoExternalExclude;
    };

export interface OutputConfig {
  /**
   * Setting the build target for Rsbuild.
   * @default 'web'
   */
  target?: RsbuildTarget;
  /**
   * Use this option to specify which modules should not be bundled by Rsbuild, and instead
   * use implementations provided by the external environment.
   * For more information, please see: [Rspack Externals](https://rspack.rs/config/externals)
   * @default undefined
   */
  externals?: Externals;
  /**
   * Automatically externalize dependencies declared in the root package.json.
   * This option will generate `externals` rules for matching dependencies and their subpath imports.
   * @default false
   */
  autoExternal?: AutoExternal;
  /**
   * Set the directory of the output files.
   * Rsbuild will emit files to the specified subdirectory according to the file type.
   * - `string`: Set the root output directory to a specific path, equivalent to `distPath.root`.
   * - `object`: Set the output directory for each file type.
   */
  distPath?: string | DistPathConfig;
  /**
   * Sets the filename of output files.
   */
  filename?: FilenameConfig;
  /**
   * Specify the character encoding format for output files.
   * Can be `ascii` or `utf8`.
   * @default 'utf8'
   */
  charset?: Charset;
  /**
   * Configure how the polyfill is injected.
   * @default 'off'
   */
  polyfill?: Polyfill;
  /**
   * When using CDN in the production,
   * you can use this option to set the URL prefix of static assets,
   * similar to the `output.publicPath` config of Rspack.
   * `auto` means use a relative path based on file location.
   * @default `server.base`
   */
  assetPrefix?: LiteralUnion<'auto', string>;
  /**
   * Set the size threshold to inline static assets such as images and fonts.
   * By default, static assets will be Base64 encoded and inline into the page if
   * the size is less than 4KiB.
   * @default { svg: 4096, font: 4096, image: 4096, media: 4096, assets: 4096 }
   */
  dataUriLimit?: number | DataUriLimit;
  /**
   * Configure how to handle the legal comment.
   * A "legal comment" is considered to be any statement-level comment in JS or rule-level
   * comment in CSS that contains @license or @preserve or that starts with //! or /\*!.
   * These comments are preserved in output files by default since that follows the intent
   * of the original authors of the code.
   * @default 'linked'
   */
  legalComments?: LegalComments;
  /**
   * Whether to clean up all files under the output directory before the build starts.
   * @default 'auto'
   */
  cleanDistPath?: CleanDistPath;
  /**
   * Allow to custom CSS Modules options.
   */
  cssModules?: CSSModules;
  /**
   * Configure whether to enable code minification in production mode, or to configure
   * minimizer options.
   * @default true
   */
  minify?: Minify;
  /**
   * Configure how to generate the manifest file.
   * - `true`: Generate a manifest file named `manifest.json` in the output directory.
   * - `false`: Do not generate the manifest file.
   * - `string`: Generate a manifest file with the specified filename or path.
   * - `object`: Generate a manifest file with the specified options.
   * @default false
   */
  manifest?: ManifestConfig;
  /**
   * Whether to output JavaScript files in ES modules format.
   * @default true when `output.target` is `node`, otherwise `false`
   */
  module?: boolean;
  /**
   * Whether to generate source map files, and which format of source map to generate.
   *
   * @default
   * ```js
   * const defaultSourceMap = {
   *   js: isDev ? 'cheap-module-source-map' : false,
   *   css: false,
   *   extract: false,
   * };
   * ```
   */
  sourceMap?: boolean | SourceMap;
  /**
   * Whether to add filename hash.
   * - `true`: JavaScript and CSS filenames include hash in production mode, while other assets
   * always include hash in all modes.
   * - `false`: Disable filename hash.
   * - `string`: Enable filename hash and customize the hash format, such as `'contenthash:16'`.
   * - `object`: An object to configure filename hash behavior.
   * @default true
   */
  filenameHash?: FilenameHash;
  /**
   * Whether to inline output scripts files (.js files) into HTML with `<script>` tags.
   * @default false
   */
  inlineScripts?: InlineChunkConfig;
  /**
   * Whether to inline output style files (.css files) into html with `<style>` tags.
   * @default false
   */
  inlineStyles?: InlineChunkConfig;
  /**
   * Whether to inject styles into the DOM via `style-loader`.
   * @default false
   */
  injectStyles?: boolean;
  /**
   * Specifies the range of target browsers that the project is compatible with.
   * This value will be used by [SWC](https://github.com/swc-project/swc) and
   * [Lightning CSS](https://github.com/parcel-bundler/lightningcss) to identify
   * the JavaScript syntax that need to be transformed and the CSS browser prefixes
   * that need to be added.
   * @default undefined
   */
  overrideBrowserslist?: string[];
  /**
   * Copies the specified file or directory to the dist directory.
   * @default undefined
   */
  copy?: CopyRspackPluginOptions | CopyRspackPluginOptions['patterns'];
  /**
   * Whether to emit static assets such as image, font, etc.
   * Return `false` to avoid outputting unnecessary assets for some scenarios such as SSR.
   * @default true
   */
  emitAssets?: boolean;
  /**
   * Whether to emit CSS to the output bundles.
   * If `false`, the CSS will not be extracted to separate files or injected into the
   * JavaScript bundles via `output.injectStyles`.
   * @default `true` when `output.target` is `web`, otherwise `false`
   */
  emitCss?: boolean;
}

export interface NormalizedOutputConfig extends OutputConfig {
  target: RsbuildTarget;
  filename: FilenameConfig;
  distPath: Optional<Required<DistPathConfig>, 'jsAsync' | 'cssAsync' | 'js'>;
  polyfill: Polyfill;
  sourceMap:
    | boolean
    | {
        js?: Rspack.Configuration['devtool'];
        css: boolean;
        extract: SourceMapExtract;
      };
  cleanDistPath: CleanDistPath;
  filenameHash: FilenameHash;
  assetPrefix: string;
  dataUriLimit: number | NormalizedDataUriLimit;
  manifest: ManifestConfig;
  inlineScripts: InlineChunkConfig;
  inlineStyles: InlineChunkConfig;
  injectStyles: boolean;
  cssModules: {
    auto: CSSModules['auto'];
    namedExport: boolean;
    exportGlobals: boolean;
    exportLocalsConvention: CSSModulesLocalsConvention;
    localIdentName?: string;
    mode?: CSSModules['mode'];
  };
  emitAssets: boolean;
}

export type CrossOrigin = 'anonymous' | 'use-credentials';

export type ScriptInject = boolean | 'body' | 'head';

export type ScriptLoading = 'defer' | 'module' | 'blocking';

export type OutputStructure = 'flat' | 'nested';

/**
 * Custom meta tag attributes.
 * Key is the attribute name.
 * Value is the attribute value, as a string or boolean.
 *
 * @example
 * {
 *   name: 'viewport',
 *   content: 'width=500, initial-scale=1',
 * }
 */
export type MetaAttrs = Record<string, string | boolean>;

/**
 * Meta options in name-content form.
 * Key is the meta name, such as `viewport`, `description`, or `robots`.
 * The value can be:
 * - `string`: the content of the meta tag
 * - `false`: explicitly disables the meta tag
 * - `MetaAttrs`: a set of custom meta attributes
 *
 * @example
 * {
 *   viewport: 'width=device-width, initial-scale=1',
 *   description: 'My awesome website',
 *   robots: false,
 * }
 */
export type MetaOptions = Record<string, string | false | MetaAttrs>;

export type HtmlBasicTag = {
  /**
   * The HTML tag name to be generated. Should be a valid HTML element name.
   * @example
   * - `'script'` for JavaScript files
   * - `'link'` for stylesheets or external resources
   * - `'meta'` for metadata
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element
   */
  tag: string;
  /**
   * HTML attributes to be applied to the tag.
   * - `string` values will be rendered as `attribute="value"`
   * - `true` renders as boolean attribute (e.g., `<input disabled>`)
   * - `false` or `null` or `undefined` values will omit the attribute
   * 
   * @example
   * // String attributes
   * attrs: {
   *   src: 'https://example.com/script.js',
   *   type: 'text/javascript',
   * }
   * // Result: <script src="https://example.com/script.js" type="text/javascript">

   * // Boolean attributes
   * attrs: {
   *   async: true,      // <script async>
   *   defer: false,     // attribute omitted
   * }
   * // Result: <script async>
   */
  attrs?: Record<string, string | boolean | null | undefined>;
  /**
   * The innerHTML content of the tag. The content is inserted as-is without
   * HTML escaping, so ensure it's safe to prevent XSS vulnerabilities.
   */
  children?: string;
  /**
   * The metadata object for tags, used to store additional information about tags.
   * `metadata` does not affect the generated HTML content.
   * @default undefined
   */
  metadata?: Record<string, any>;
};

export type HtmlTag = HtmlBasicTag & {
  /**
   * Controls whether to add a hash query parameter to asset URLs for cache invalidation.
   * Only affects the `src` attribute of the `script` tag and the `href` attribute of the `link` tag.
   * - `false`: No hash query
   * - `true`: Generate hash based on HTML content
   * - `string`: Uses a custom hash string
   * - `function`: Custom hash generation via a function
   * @default false
   */
  hash?: boolean | string | ((url: string, hash: string) => string);
  /**
   * Controls whether to prepend the asset prefix to resource URLs.
   * Only affects the `src` attribute of the `script` tag and the `href` attribute of the `link` tag.
   * - `true`: Prepends asset prefix to the URL
   * - `false`: Uses the URL as-is
   * - `string`: Uses a custom prefix
   * - `function`: Custom path transformation via a function
   * @default true
   */
  publicPath?: boolean | string | ((url: string, publicPath: string) => string);
  /**
   * Defines the injection position relative to existing tags.
   * - `true`: Insert after existing tags
   * - `false`: Insert before existing tags
   * @default true
   */
  append?: boolean;
  /**
   * Specifies whether to inject the tag into the HTML `<head>` element.
   * - `true`: Inject into `<head>`
   * - `false`: Inject into `<body>`
   * @default Auto-detect: `true` for head-allowed elements, `false` otherwise
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/head#see_also
   */
  head?: boolean;
};

export type HtmlTagContext = {
  hash: string;
  entryName: string;
  outputName: string;
  publicPath: string;
};

export type HtmlTagHandler = (tags: HtmlTag[], context: HtmlTagContext) => HtmlTag[] | void;

export type HtmlTagDescriptor = HtmlTag | HtmlTagHandler;

type ChainedHtmlOption<O> = OneOrMany<
  O | ((context: { value: O; entryName: string }) => MaybePromise<O | void>)
>;

export type AppIconItem = {
  /**
   * The path to the icon, can be a URL, an absolute file path,
   * or a relative path to the project root.
   */
  src: string;
  /**
   * The size of the icon.
   */
  size: number;
  /**
   * Specifies the intended target for which the icon should be generated.
   * - `apple-touch-icon` for iOS system.
   * - `web-app-manifest` for web application manifest.
   */
  target?: 'apple-touch-icon' | 'web-app-manifest';
  /**
   * A case-sensitive keyword string that specifies one or more contexts in
   * which the icon can be used by the browser or operating system.
   * This field is only effective when the `target` is `'web-app-manifest'`.
   *
   * The possible properties include:
   * - `'monochrome'`: Indicates that the icon is intended to be used as a
   * monochrome icon with a solid fill.
   * - `'maskable'`: Indicates that the icon is designed with icon masks and
   * safe zone in mind.
   * - `'any'`: Indicates that the icon can be used in any context. This is
   * the default value.
   * @see https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/icons#purpose
   */
  purpose?: LiteralUnion<'any' | 'maskable' | 'monochrome', string>;
};

export type AppIcon = {
  /**
   * The name of the application.
   * @see https://developer.mozilla.org/en-US/docs/Web/Manifest/name
   */
  name?: string;
  /**
   * The list of icons.
   */
  icons: AppIconItem[];
  /**
   * The filename of the manifest file.
   * @default 'manifest.webmanifest'
   */
  filename?: string;
};

type HtmlImplementation = 'js' | 'native';

export interface HtmlConfig {
  /**
   * Configure the `<meta>` tag of the HTML.
   *
   * @default
   * ```js
   * const defaultMeta = {
   *   charset: { charset: 'utf-8' },
   *   viewport: 'width=device-width, initial-scale=1.0',
   * };
   * ```
   */
  meta?: ChainedHtmlOption<MetaOptions>;
  /**
   * Set the title tag of the HTML page.
   * @default 'Rsbuild App'
   */
  title?: ChainedHtmlOption<string>;
  /**
   * Set the inject position of the `<script>` tag.
   * @default 'head'
   */
  inject?: ChainedHtmlOption<ScriptInject>;
  /**
   * Inject custom html tags into the output html files.
   * @default undefined
   */
  tags?: OneOrMany<HtmlTagDescriptor>;
  /**
   * Set the favicon icon for all pages.
   * @default undefined
   */
  favicon?: ChainedHtmlOption<string>;
  /**
   * Set the web application icons to display when added to the home screen of a mobile device.
   *
   * @default undefined
   * @example
   * appIcon: {
   *   name: 'My Website',
   *   icons: [
   *     { src: './icon-192.png', size: 192 },
   *     { src: './icon-512.png', size: 512 },
   *   ]
   * }
   */
  appIcon?: AppIcon;
  /**
   * Set the id of root element.
   * @default 'root'
   */
  mountId?: string;
  /**
   * Set the [crossorigin](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/crossorigin) attribute
   * of the `<script>` tag.
   * @default false
   */
  crossorigin?: boolean | CrossOrigin;
  /**
   * Define the directory structure of the HTML output files.
   * @default 'flat'
   */
  outputStructure?: OutputStructure;
  /**
   * Define the path to the HTML template,
   * corresponding to the `template` config of [html-rspack-plugin](https://github.com/rstackjs/html-rspack-plugin).
   * @default A built-in HTML template
   */
  template?: ChainedHtmlOption<string>;
  /**
   * Define the parameters in the HTML template,
   * corresponding to the `templateParameters` config of [html-rspack-plugin](https://github.com/rstackjs/html-rspack-plugin).
   */
  templateParameters?: ConfigChainAsyncWithContext<Record<string, unknown>, { entryName: string }>;
  /**
   * Specifies how `<script>` tags generated by Rsbuild are loaded.
   * - `'defer'`: Adds the `defer` attribute so scripts load in parallel and run after
   * the document has been parsed.
   * - `'module'`: Adds `type="module"` to enable ES modules semantics.
   * - `'blocking'`: No `defer` or `async`, scripts execute immediately in order.
   * @default 'defer'. If `output.module` is enabled, the value is always `'module'`.
   */
  scriptLoading?: ScriptLoading;
  /**
   * Specifies which implementation to use for generating HTML files.
   *
   * - `'js'` (default) - Use the JavaScript-based `html-rspack-plugin`.
   * - `'native'` - Use Rspack's built-in `HtmlRspackPlugin` implemented in Rust.
   *
   * This option is experimental and may affect the available options in `tools.htmlPlugin`,
   * since the two implementations are not fully compatible.
   *
   * @default 'js'
   * @experimental
   */
  implementation?: HtmlImplementation;
}

export type NormalizedHtmlConfig = HtmlConfig & {
  meta: ChainedHtmlOption<MetaOptions>;
  title: ChainedHtmlOption<string>;
  mountId: string;
  inject: ChainedHtmlOption<ScriptInject>;
  crossorigin: boolean | CrossOrigin;
  outputStructure: OutputStructure;
  scriptLoading: ScriptLoading;
  implementation: HtmlImplementation;
};

export type ProgressBarConfig = {
  id?: string;
};

export type RequestHandler = Connect.NextHandleFunction;

export type EnvironmentAPI = Record<
  string,
  {
    /**
     * Get stats info about current environment.
     */
    getStats: () => Promise<Rspack.Stats>;

    /**
     * Load and execute stats bundle in Server.
     *
     * @param entryName - relate to rsbuild source.entry
     * @returns the return of entry module.
     */
    loadBundle: <T = unknown>(entryName: string) => Promise<T>;

    /**
     * Get the compiled HTML template.
     */
    getTransformedHtml: (entryName: string) => Promise<string>;

    /**
     * Send HMR message to the current environment only.
     */
    hot: {
      send: HotSend;
    };

    /**
     * Provides some context information about the current environment
     */
    context: EnvironmentContext;
  }
>;

export type SetupMiddlewaresContext = Pick<RsbuildDevServer, 'sockWrite' | 'environments'>;

export type SetupMiddlewaresFn = (
  middlewares: {
    unshift: (...handlers: RequestHandler[]) => void;
    push: (...handlers: RequestHandler[]) => void;
  },
  server: SetupMiddlewaresContext,
) => void;

export type OverlayOptions = {
  /**
   * Whether to show build errors in the overlay. You can pass a filter
   * function to control which formatted build errors are rendered.
   * Return false from the filter function to hide a specific error.
   * @default true
   */
  errors?: boolean | ((error: Error) => boolean);
  /**
   * Whether to show runtime errors in the overlay. You can pass a filter
   * function to control which runtime errors are rendered.
   * Return false from the filter function to hide a specific error.
   * @default false
   */
  runtime?: boolean | ((error: Error) => boolean);
};

export type ClientConfig = {
  /**
   * The path for the WebSocket request.
   * @default '/rsbuild-hmr'
   */
  path?: string;
  /**
   * The port number for the WebSocket request.
   * @default location.port
   */
  port?: string | number;
  /**
   * The host for the WebSocket request.
   * @default location.hostname
   */
  host?: string;
  /**
   * The protocol name for the WebSocket request.
   * @default location.protocol === 'https:' ? 'wss' : 'ws'
   */
  protocol?: 'ws' | 'wss';
  /**
   * The maximum number of reconnection attempts after a WebSocket request is disconnected.
   * @default 100
   */
  reconnect?: number;
  /**
   * Whether to display an error overlay in the browser.
   * @default true
   */
  overlay?: boolean | OverlayOptions;
  /**
   * Controls the log level for client-side logging in the browser console.
   * @default 'info'
   */
  logLevel?: 'info' | 'warn' | 'error' | 'silent';
  /**
   * The path to a browser-side module that resolves the WebSocket URL.
   * The module should default export a function: `(url: string) => string`.
   */
  webSocketUrlResolver?: string;
};

export type NormalizedClientConfig = Optional<
  Required<ClientConfig>,
  'protocol' | 'webSocketUrlResolver'
>;

export type WebSocketUrlResolver = (url: string) => string;

export type { ChokidarOptions };

export type WatchFiles = {
  /**
   * Paths of the files or directories to watch, supports glob syntax.
   */
  paths: string | string[];
  /**
   * Watch options passed to [chokidar](https://github.com/paulmillr/chokidar).
   */
  options?: ChokidarOptions;
  /**
   * Specifies whether to reload the page or restart the dev server when files change.
   * @default 'reload-page'
   */
  type?: 'reload-page' | 'reload-server';
};

export type CliShortcut = {
  /**
   * The key to trigger the shortcut.
   */
  key: string;
  /**
   * The description of the shortcut.
   */
  description: string;
  /**
   * The action to execute when the shortcut is triggered.
   */
  action: () => void | Promise<void>;
};

export type WriteToDisk = boolean | ((filename: string) => boolean);

export type BrowserLogsStackTrace = 'summary' | 'full' | 'none';

export type LiveReload =
  | boolean
  | {
      /**
       * Whether to trigger a full page reload when the HTML template changes.
       * @default true
       */
      html?: boolean;
    };

export interface DevConfig {
  /**
   * Controls whether to forward browser runtime errors to the terminal. When `true`, the dev
   * client listens for `window.error` events and unhandled Promise rejections in the browser,
   * then sends them to the dev server where they are printed in the terminal (prefixed with
   * `[browser]`).
   * @default { stackTrace: 'summary' }
   */
  browserLogs?:
    | boolean
    | {
        /**
         * Controls how the error stack trace is displayed in the terminal when forwarding
         * browser errors.
         * - `'summary'` – Show only the first frame (e.g. `(src/App.jsx:3:0)`).
         * - `'full'` – Print the full stack trace with all frames.
         * - `'none'` – Hide stack traces.
         * @default 'summary'
         */
        stackTrace?: BrowserLogsStackTrace;
      };
  /**
   * Whether to enable Hot Module Replacement.
   * @default true
   */
  hmr?: boolean;
  /**
   * Whether to reload the page when file changes are detected.
   * @default true
   */
  liveReload?: LiveReload;
  /**
   * Set the URL prefix of static assets in development mode,
   * similar to the [output.publicPath](https://rspack.rs/config/output#outputpublicpath)
   * config of Rspack.
   * @default `server.base`
   */
  assetPrefix?: LiteralUnion<'auto', string> | boolean;
  /**
   * Whether to render progress bars to display the build progress.
   * @default false
   */
  progressBar?: boolean | ProgressBarConfig;
  /**
   * Config for Rsbuild client code.
   */
  client?: ClientConfig;
  /**
   * Whether to enable CLI shortcuts.
   * @default true when using Rsbuild CLI, otherwise false
   */
  cliShortcuts?:
    | boolean
    | {
        /**
         * Customize the CLI shortcuts.
         * @param shortcuts - The default CLI shortcuts.
         * @returns - The customized CLI shortcuts.
         */
        custom?: (shortcuts: CliShortcut[]) => CliShortcut[];
        /**
         * Whether to print the help hint when the server is started.
         * - `true`: Print the default help hint.
         * - `false`: Disable the help hint.
         * - `string`: Print a custom help hint.
         * @default true
         */
        help?: boolean | string;
      };
  /**
   * Used to add custom middleware to the dev server.
   * @deprecated Use `server.setup` instead
   * @default undefined
   */
  setupMiddlewares?: SetupMiddlewaresFn | SetupMiddlewaresFn[];
  /**
   * Controls whether the build output from development mode is written to disk.
   * @default false
   */
  writeToDisk?: WriteToDisk;
  /**
   * Watch specified files and directories for changes. When a file change is detected,
   * it can trigger a page reload or restart the dev server.
   * @default undefined
   */
  watchFiles?: WatchFiles | WatchFiles[];
  /**
   * Enable lazy compilation (compilation on demand).
   * @default { imports: true, entries: false }
   */
  lazyCompilation?: boolean | Rspack.LazyCompilationOptions;
}

export type NormalizedDevConfig = Omit<DevConfig, 'watchFiles'> &
  Required<
    Pick<
      DevConfig,
      'hmr' | 'liveReload' | 'assetPrefix' | 'writeToDisk' | 'cliShortcuts' | 'browserLogs'
    >
  > & {
    watchFiles: WatchFiles[];
    client: NormalizedClientConfig;
  };

export interface ResolveConfig {
  /**
   * Force Rsbuild to resolve the specified packages from project root,
   * which is useful for deduplicating packages and reducing the bundle size.
   */
  dedupe?: string[];
  /**
   * Set the alias for the module path, which is used to simplify the import path or
   * redirect the module reference.
   * Similar to the [resolve.alias](https://rspack.rs/config/resolve) config of Rspack.
   * @default { '@swc/helpers': path.dirname(require.resolve('@swc/helpers/package.json')) }
   */
  alias?: ConfigChain<Alias>;
  /**
   * Set the strategy for path alias resolution, to control the priority relationship
   * between the `paths` option in `tsconfig.json` and the `resolve.alias` option of Rsbuild.
   * - `prefer-tsconfig`: The `paths` option in `tsconfig.json` will take precedence over the
   * `resolve.alias` option of Rsbuild.
   * - `prefer-alias`: The `resolve.alias` option of Rsbuild will take precedence over the
   * `paths` option in `tsconfig.json`.
   * @default 'prefer-tsconfig'
   */
  aliasStrategy?: AliasStrategy;
  /**
   * Automatically resolve file extensions when importing modules.
   * This means you can import files without explicitly writing their extensions.
   * @default ['.ts', '.tsx', '.mjs', '.js', '.jsx', '.json']
   */
  extensions?: string[];
  /**
   * Specifies the condition names used to match entry points in the exports field
   * of a package.
   * @default Inherits from Rspack. See https://rspack.rs/config/resolve#resolveconditionnames
   */
  conditionNames?: string[];
  /**
   * Controls the priority of fields in a package.json used to locate a package's
   * entry file. It is the ordered list of package.json fields Rspack will try
   * when resolving an npm package's entry point.
   * @default
   * - If `output.target` is `'web'`, `'web-worker'`, or not specified, the default value is `["browser", "module", "main"]`.
   * - If `output.target` is `'node'`, the default value is `["module", "main"]`.
   */
  mainFields?: string[];
}

export type NormalizedResolveConfig = ResolveConfig &
  Pick<Required<ResolveConfig>, 'alias' | 'aliasStrategy' | 'extensions'>;

export type ModuleFederationConfig = {
  options: ModuleFederationPluginOptions;
};

export type NormalizedModuleFederationConfig = ModuleFederationConfig;

export type RsbuildConfigMeta = {
  /**
   * Path to the rsbuild config file.
   */
  configFilePath: string;
};

/**
 * Only some dev options can be defined in the environment config
 */
export type AllowedEnvironmentDevKeys =
  | 'hmr'
  | 'client'
  | 'liveReload'
  | 'browserLogs'
  | 'assetPrefix'
  | 'progressBar'
  | 'lazyCompilation'
  | 'writeToDisk';

/**
 * The Rsbuild config to run in the specified environment.
 */
export interface EnvironmentConfig {
  /**
   * Options for local development.
   */
  dev?: Pick<DevConfig, AllowedEnvironmentDevKeys>;
  /**
   * Options for HTML generation.
   */
  html?: HtmlConfig;
  /**
   * Options for the low-level tools.
   */
  tools?: ToolsConfig;
  /**
   * Options for module resolution.
   */
  resolve?: ResolveConfig;
  /**
   * Options for input source code.
   */
  source?: SourceConfig;
  /**
   * Options for build outputs.
   */
  output?: OutputConfig;
  /**
   * Options for Web security.
   */
  security?: SecurityConfig;
  /**
   * Options for build performance and runtime performance.
   */
  performance?: PerformanceConfig;
  /**
   * Options for chunk splitting.
   */
  splitChunks?: SplitChunksConfig | false;
  /**
   * Options for module federation.
   */
  moduleFederation?: ModuleFederationConfig;
  /**
   * Configure Rsbuild plugins.
   */
  plugins?: RsbuildPlugins;
}

export type LogLevel = 'info' | 'warn' | 'error' | 'silent';

/**
 * The Rsbuild config.
 */
export interface RsbuildConfig extends EnvironmentConfig {
  /**
   * Specify the build mode for Rsbuild, as each mode has different default behavior and optimizations.
   * @default Depends on `process.env.NODE_ENV`:
   * - `'production'` if NODE_ENV is 'production'
   * - `'development'` if NODE_ENV is 'development'
   * - otherwise `'none'`
   */
  mode?: RsbuildMode;
  /**
   * Specify the project root directory. Can be an absolute path, or a path relative to `process.cwd()`.
   * @default `process.cwd()`
   */
  root?: string;
  /**
   * Specify the log level of Rsbuild.
   * - 'info': Output all logs.
   * - 'warn': Output `warn` and `error` level logs.
   * - 'error': Output `error` level logs.
   * - 'silent': Do not output any logs.
   * @default 'info'
   */
  logLevel?: LogLevel;
  /**
   * Use a custom logger instance for the current Rsbuild instance.
   * You can create one via `createLogger()`.
   */
  customLogger?: Logger;
  /**
   * Options for local development.
   */
  dev?: DevConfig;
  /**
   * Options for the Rsbuild server.
   * Mainly applies to local development and preview.
   * Some options (e.g. `publicDir`, `base`) also affect production builds.
   */
  server?: ServerConfig;
  /**
   * Configure Rsbuild config by environment.
   * The key represents the environment name.
   * The value is the Rsbuild config for the specified environment.
   */
  environments?: Record<string, EnvironmentConfig>;
  /**
   * @private
   */
  _privateMeta?: RsbuildConfigMeta;
}

export type MergedEnvironmentConfig = {
  mode: RsbuildMode;
  root: string;
  dev: Pick<NormalizedDevConfig, AllowedEnvironmentDevKeys>;
  html: NormalizedHtmlConfig;
  tools: NormalizedToolsConfig;
  resolve: NormalizedResolveConfig;
  source: NormalizedSourceConfig;
  output: Omit<NormalizedOutputConfig, 'distPath'> & {
    distPath: Optional<Required<DistPathConfig>, 'jsAsync' | 'cssAsync'>;
  };
  plugins?: RsbuildPlugins;
  security: NormalizedSecurityConfig;
  performance: NormalizedPerformanceConfig;
  splitChunks: NormalizedSplitChunksConfig | false;
  moduleFederation?: ModuleFederationConfig;
};

/**
 * The normalized Rsbuild environment config.
 */
export type NormalizedEnvironmentConfig = TwoLevelReadonly<
  Omit<MergedEnvironmentConfig, 'dev'> & {
    dev: NormalizedDevConfig;
    server: NormalizedServerConfig;
    _privateMeta?: RsbuildConfigMeta;
  }
>;

export type NormalizedConfig = NormalizedEnvironmentConfig & {
  environments: Record<string, NormalizedEnvironmentConfig>;
};
