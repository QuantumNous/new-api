import type { rspack } from '@rspack/core';
import type { ChainIdentifier, ManifestData } from '..';
import type { RsbuildDevServer } from '../server/devServer';
import type { RsbuildPreviewServer } from '../server/previewServer';
import type { RspackChain } from '../types';
import type {
  EnvironmentConfig,
  HtmlBasicTag,
  MergedEnvironmentConfig,
  NormalizedEnvironmentConfig,
  RsbuildConfig,
} from './config';
import type { RsbuildEntry, RsbuildTarget } from './rsbuild';
import type { Rspack } from './rspack';
import type { HtmlRspackPlugin } from './thirdParty';
import type { MaybePromise } from './utils';

type CompileCommonParams = {
  isFirstCompile: boolean;
  isWatch: boolean;
};

export type OnBeforeEnvironmentCompileFn = (
  params: CompileCommonParams & {
    environment: EnvironmentContext;
    bundlerConfig?: Rspack.Configuration;
  },
) => MaybePromise<void>;

export type OnCloseBuildFn = () => MaybePromise<void>;

export type OnBeforeBuildFn = (
  params: CompileCommonParams & {
    /**
     * Context information for all environments.
     */
    environments: Record<string, EnvironmentContext>;
    bundlerConfigs?: Rspack.Configuration[];
  },
) => MaybePromise<void>;

export type OnBeforeDevCompileFn = (
  params: CompileCommonParams & {
    /**
     * Context information for all environments.
     */
    environments: Record<string, EnvironmentContext>;
    bundlerConfigs?: Rspack.Configuration[];
  },
) => MaybePromise<void>;

export type OnAfterEnvironmentCompileFn = (
  params: CompileCommonParams & {
    stats?: Rspack.Stats;
    /**
     * The time it takes to build the current environment in milliseconds.
     */
    time: number;
    environment: EnvironmentContext;
  },
) => MaybePromise<void>;

export type OnAfterBuildFn = (
  params: CompileCommonParams & {
    stats?: Rspack.Stats | Rspack.MultiStats;
    /**
     * Context information for all environments.
     */
    environments: Record<string, EnvironmentContext>;
  },
) => MaybePromise<void>;

export type OnCloseDevServerFn = () => MaybePromise<void>;

export type OnAfterDevCompileFn = (params: {
  isFirstCompile: boolean;
  stats: Rspack.Stats | Rspack.MultiStats;
  /**
   * Context information for all environments.
   */
  environments: Record<string, EnvironmentContext>;
}) => MaybePromise<void>;

/**
 * @deprecated Use `OnAfterDevCompileFn` instead.
 */
export type OnDevCompileDoneFn = OnAfterDevCompileFn;

export type OnBeforeStartDevServerFn = (params: {
  /**
   * The dev server instance, the same as the return value of `createDevServer`.
   */
  server: RsbuildDevServer;
  /**
   * Context information for all environments.
   */
  environments: Record<string, EnvironmentContext>;
}) => MaybePromise<(() => MaybePromise<void>) | void>;

export type OnBeforeStartPreviewServerFn = (params: {
  /**
   * The preview server instance.
   */
  server: RsbuildPreviewServer;
  /**
   * Context information for all environments.
   */
  environments: Record<string, EnvironmentContext>;
}) => MaybePromise<void>;

export type Routes = {
  entryName: string;
  pathname: string;
}[];

export type OnAfterStartDevServerFn = (params: {
  port: number;
  routes: Routes;
  /**
   * Context information for all environments.
   */
  environments: Record<string, EnvironmentContext>;
}) => MaybePromise<void>;

export type OnAfterStartPreviewServerFn = (params: {
  port: number;
  routes: Routes;
  /**
   * Context information for all environments.
   */
  environments: Record<string, EnvironmentContext>;
}) => MaybePromise<void>;

export type OnBeforeCreateCompilerFn = (params: {
  bundlerConfigs: Rspack.Configuration[];
  /**
   * Context information for all environments.
   */
  environments: Record<string, EnvironmentContext>;
}) => MaybePromise<void>;

export type OnAfterCreateCompilerFn<Compiler = Rspack.Compiler | Rspack.MultiCompiler> = (params: {
  compiler: Compiler;
  /**
   * Context information for all environments.
   */
  environments: Record<string, EnvironmentContext>;
}) => MaybePromise<void>;

export type OnExitFn = (context: { exitCode: number }) => void;

export type ModifyHTMLContext = {
  /**
   * The Compilation object of Rspack.
   */
  compilation: Rspack.Compilation;
  /**
   * The Compiler object of Rspack.
   */
  compiler: Rspack.Compiler;
  /**
   * The name of the HTML file, relative to the dist directory.
   * @example 'index.html'
   */
  filename: string;
  /**
   * The environment context for current build.
   */
  environment: EnvironmentContext;
};

export type ModifyHTMLFn = (html: string, context: ModifyHTMLContext) => MaybePromise<string>;

type HTMLTags = {
  headTags: HtmlBasicTag[];
  bodyTags: HtmlBasicTag[];
};

export type ModifyHTMLTagsContext = Pick<
  ModifyHTMLContext,
  'compilation' | 'compiler' | 'filename' | 'environment'
> & {
  /**
   * URL prefix of assets.
   * @example 'https://example.com/'
   */
  assetPrefix: string;
};

export type ModifyHTMLTagsFn = (
  tags: HTMLTags,
  context: ModifyHTMLTagsContext,
) => MaybePromise<HTMLTags>;

export type ModifyRsbuildConfigUtils = {
  /** Merge multiple Rsbuild config objects into one. */
  mergeRsbuildConfig: (...configs: RsbuildConfig[]) => RsbuildConfig;
};

type ArrayAtLeastOne<A, B> = [A, ...(A | B)[]] | [...(A | B)[], A];

export type ModifyEnvironmentConfigUtils = {
  /** environment name. */
  name: string;
  /** Merge multiple Rsbuild environment config objects into one. */
  mergeEnvironmentConfig: (
    ...configs: ArrayAtLeastOne<MergedEnvironmentConfig, EnvironmentConfig>
  ) => MergedEnvironmentConfig;
};

export type ModifyRsbuildConfigFn = (
  config: RsbuildConfig,
  utils: ModifyRsbuildConfigUtils,
) => MaybePromise<RsbuildConfig | void>;

export type ModifyEnvironmentConfigFn = (
  config: MergedEnvironmentConfig,
  utils: ModifyEnvironmentConfigUtils,
) => MaybePromise<MergedEnvironmentConfig | void>;

export type EnvironmentContext = {
  /**
   * The index of the current environment.
   */
  index: number;
  /**
   * The unique name of the current environment is used to distinguish and locate the
   * environment, corresponds to the key in the `environments` configuration.
   */
  name: string;
  /**
   * The entry object from the `source.entry` option.
   */
  entry: RsbuildEntry;
  /**
   * The path information for all HTML assets.
   * This value is an object, the key is the entry name and the value is the relative
   * path of the HTML file in the dist directory.
   */
  htmlPaths: Record<string, string>;
  /**
   * The absolute path of the output directory, corresponding to the `output.distPath.root`
   * config of Rsbuild.
   */
  distPath: string;
  /**
   * The browserslist configuration of the current environment.
   */
  browserslist: string[];
  /**
   * The absolute path of the tsconfig.json file, or `undefined` if the tsconfig.json file
   * does not exist in current project.
   */
  tsconfigPath?: string;
  /**
   * The normalized Rsbuild config for the current environment.
   */
  config: NormalizedEnvironmentConfig;
  /**
   * Manifest data. Only available when:
   * - The `output.manifest` config is enabled
   * - The build has completed, accessible in hooks like `onAfterBuild`,
   * `onAfterDevCompile` and `onAfterEnvironmentCompile` or via the environment API
   */
  manifest?: Record<string, unknown> | ManifestData;
  /**
   * WebSocket authentication token, used to authenticate WebSocket connections and
   * prevent unauthorized access. Only available in the development mode, and is
   * an empty string in the production mode.
   */
  webSocketToken: string;
};

export type ModifyChainUtils = {
  /**
   * The value of `process.env.NODE_ENV`
   */
  env: string;
  /**
   * A boolean value indicating whether this is a development build.
   * Set to `true` when the `mode` is `development`.
   */
  isDev: boolean;
  /**
   * A boolean value indicating whether this is a production build.
   * Set to `true` when the `mode` is `production`.
   */
  isProd: boolean;
  /**
   * The current build target.
   */
  target: RsbuildTarget;
  /**
   * A boolean value indicating whether the build target is `node`.
   * Equivalent to `target === 'node'`.
   */
  isServer: boolean;
  /**
   * A boolean value indicating whether the build target is `web-worker`.
   * Equivalent to `target === 'web-worker'`.
   */
  isWebWorker: boolean;
  /**
   * Predefined chain IDs.
   */
  CHAIN_ID: ChainIdentifier;
  /**
   * The environment context for current build.
   */
  environment: EnvironmentContext;
  /**
   * Context information for all environments.
   */
  environments: Record<string, EnvironmentContext>;
  /**
   * The Rspack instance, same as `import { rspack } from '@rsbuild/core'`.
   */
  rspack: typeof rspack;
  /**
   * The default export of `html-rspack-plugin`.
   */
  HtmlPlugin: typeof HtmlRspackPlugin;
};

export type ModifyBundlerChainUtils = ModifyChainUtils & {
  /**
   * @deprecated Use `rspack` instead.
   */
  bundler: typeof rspack;
};

export type ModifyBundlerChainFn = (
  chain: RspackChain,
  utils: ModifyBundlerChainUtils,
) => MaybePromise<void>;

export type CreateAsyncHook<Callback extends (...args: any[]) => any> = {
  tap: (cb: Callback) => void;
  call: (...args: Parameters<Callback>) => Promise<Parameters<Callback>>;
};
