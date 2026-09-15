import type { Compiler, MultiCompiler } from '@rspack/core';
import type { LoadEnvOptions } from '../loadEnv';
import type { Logger } from '../logger';
import type { RsbuildDevServer } from '../server/devServer';
import type { StartDevServerResult, StartPreviewServerResult } from '../server/helper';
import type { NormalizedConfig, NormalizedEnvironmentConfig, RsbuildConfig } from './config';
import type { RsbuildContext } from './context';
import type { RsbuildPlugin, RsbuildPluginAPI } from './plugin';
import type { Rspack } from './rspack';
import type { Falsy } from './utils';

export type StartDevServerOptions = {
  /**
   * Whether to get port silently and not print any logs.
   * @default false
   */
  getPortSilently?: boolean;
};

export type CreateDevServerOptions = StartDevServerOptions & {
  /**
   * Whether to trigger Rsbuild compilation
   * @default true
   */
  runCompile?: boolean;
};

export type PreviewOptions = {
  /**
   * Whether to get port silently and not print any logs.
   * @default false
   */
  getPortSilently?: boolean;
  /**
   * Whether to check if the dist directory exists and is not empty.
   * @default true
   */
  checkDistDir?: boolean;
};

export type BuildOptions = {
  /**
   * Whether to watch for file changes and rebuild.
   * @default false
   */
  watch?: boolean;
};

export type Build = (options?: BuildOptions) => Promise<BuildResult>;

export type BuildResult = {
  /**
   * Close the build and call the `onCloseBuild` hook.
   * In watch mode, this method will stop watching.
   */
  close: () => Promise<void>;
  /**
   * Rspack's [stats](https://rspack.rs/api/javascript-api/stats) object.
   */
  stats?: Rspack.Stats | Rspack.MultiStats;
};

export type InitConfigsOptions = Pick<RsbuildContext, 'action'>;

export type InspectConfigOptions = {
  /**
   * Inspect the config in the specified mode.
   * Available options: 'development' or 'production'.
   * @default 'development'
   */
  mode?: RsbuildMode;
  /**
   * Enables verbose mode to display the complete function
   * content in the configuration.
   * @default false
   */
  verbose?: boolean;
  /**
   * Specify the output path for inspection results.
   * @default 'output.distPath.root'
   */
  outputPath?: string;
  /**
   * Whether to write the inspection results to disk.
   * @default false
   */
  writeToDisk?: boolean;
  /**
   * Extra configurations to be output.
   * - key: The name of the configuration
   * - value: The configuration object
   * @example
   * extraConfigs: {
   *   // Output `rstest.config.mjs` file
   *   'rstest': {
   *     // ...
   *   },
   * }
   */
  extraConfigs?: Record<string, unknown>;
};

export type InspectConfigResult = {
  rsbuildConfig: string;
  bundlerConfigs: string[];
  environmentConfigs: string[];
  origin: {
    rsbuildConfig: Omit<NormalizedConfig, 'environments'>;
    environmentConfigs: Record<string, NormalizedEnvironmentConfig>;
    bundlerConfigs: Rspack.Configuration[];
  };
};

export type CreateCompiler = () => Promise<Compiler | MultiCompiler>;

export type CreateRsbuildOptions = {
  /**
   * The root path of current project.
   * @default process.cwd()
   */
  cwd?: string;
  /**
   * The name of the framework or tool that is currently invoking Rsbuild.
   * This allows plugins to tailor their behavior based on the calling context.
   * Rsbuild plugins can access this value via `api.context.callerName`.
   * @default 'rsbuild'
   */
  callerName?: string;
  /**
   * Only build specified environments.
   * For example, passing `['web']` will only build the `web` environment.
   * If not specified or passing an empty array, all environments will be built.
   */
  environment?: string[];
  /**
   * Alias for `config`.
   * This option will be deprecated in the future.
   */
  rsbuildConfig?: RsbuildConfig | (() => Promise<RsbuildConfig>);
  /**
   * Rsbuild configurations.
   * Passing a function to load the config asynchronously with custom logic.
   */
  config?: RsbuildConfig | (() => Promise<RsbuildConfig>);
  /**
   * Whether to call `loadEnv` to load environment variables and define them
   * as global variables via `source.define`.
   * @default false
   */
  loadEnv?: boolean | LoadEnvOptions;
};

export type ResolvedCreateRsbuildOptions = Required<
  Pick<CreateRsbuildOptions, 'cwd' | 'callerName'>
> &
  Pick<CreateRsbuildOptions, 'loadEnv' | 'environment'> & {
    rsbuildConfig: RsbuildConfig;
  };

export type CreateDevServer = (options?: CreateDevServerOptions) => Promise<RsbuildDevServer>;

export type StartDevServer = (options?: StartDevServerOptions) => Promise<StartDevServerResult>;

export type InspectConfig = (options?: InspectConfigOptions) => Promise<InspectConfigResult>;

export type AddPluginsOptions = {
  /**
   * Insert before the specified plugin.
   */
  before?: string;
  /**
   * Specify the environment that the plugin will be applied to.
   * If not specified, the plugin will be be registered as a global plugin and
   * applied to all environments.
   */
  environment?: string;
};

export type AddPlugins = (plugins: (RsbuildPlugin | Falsy)[], options?: AddPluginsOptions) => void;

export type RsbuildInstance = {
  /**
   * The logger associated with the current Rsbuild instance.
   * It reflects `config.customLogger` when provided, otherwise uses a logger
   * created specifically for the current Rsbuild instance.
   */
  logger: Logger;
  /**
   * Register one or more Rsbuild plugins, which can be called multiple times.
   * This method needs to be called before compiling. If it is called after
   * compiling, it will not affect the compilation result.
   */
  addPlugins: AddPlugins;
  /**
   * Get all the Rsbuild plugins registered in the current Rsbuild instance.
   */
  getPlugins: (options?: {
    /**
     * Get the plugins in the specified environment.
     * If environment is not specified, get the global plugins.
     */
    environment: string;
  }) => RsbuildPlugin[];
  /**
   * Removes one or more Rsbuild plugins, which can be called multiple times.
   * This method needs to be called before compiling. If it is called after
   * compiling, it will not affect the compilation result.
   */
  removePlugins: (
    pluginNames: string[],
    options?: {
      /**
       * Remove the plugin in the specified environment.
       * If environment is not specified, remove it in all environments.
       */
      environment?: string;
    },
  ) => void;
  /**
   * Perform a production mode build. This method will generate optimized
   * production bundles and emit them to the output directory.
   */
  build: Build;
  /**
   * Start a server to preview the production build locally.
   * This method should be executed after `rsbuild.build`.
   */
  preview: (options?: PreviewOptions) => Promise<StartPreviewServerResult>;
  /**
   * Initialize and return the internal Rspack configurations used by Rsbuild.
   * This method processes all plugins and configurations to generate the final
   * Rspack configs. Note: You typically don't need to call this method directly
   * since it's automatically invoked by methods like `rsbuild.build` and
   * `rsbuild.startDevServer`.
   */
  initConfigs: (options?: InitConfigsOptions) => Promise<Rspack.Configuration[]>;
  /**
   * Inspect and debug Rsbuild's internal configurations. It provides access to:
   * - The resolved Rsbuild configuration
   * - The environment-specific Rsbuild configurations
   * - The generated Rspack configurations
   *
   * The method serializes these configurations to strings and optionally writes
   * them to disk for inspection.
   */
  inspectConfig: (options?: InspectConfigOptions) => Promise<InspectConfigResult>;
  /**
   * Create an Rspack [Compiler](https://rspack.rs/api/javascript-api/compiler)
   * instance. If there are multiple [environments](/config/environments) for
   * this build, the return value is `MultiCompiler`.
   */
  createCompiler: CreateCompiler;
  /**
   * Rsbuild includes a built-in dev server designed to improve the development
   * experience. When you run the `rsbuild dev` command, the server starts
   * automatically and provides features such as page preview, routing, and hot
   * module reloading.
   *
   * If you want to integrate the Rsbuild dev server into a custom server, you
   * can use the `createDevServer` method to create a dev server instance and
   * call its methods as needed.
   *
   * If you want to directly start the Rsbuild dev server, use the
   * `rsbuild.startDevServer` method.
   */
  createDevServer: CreateDevServer;
  /**
   * Start the local dev server. This method will:
   *
   * 1. Start a development server that serves your application.
   * 2. Watch for file changes and trigger recompilation.
   */
  startDevServer: StartDevServer;
} & Pick<
  RsbuildPluginAPI,
  | 'context'
  | 'expose'
  | 'getNormalizedConfig'
  | 'getRsbuildConfig'
  | 'isPluginExists'
  | 'modifyEnvironmentConfig'
  | 'modifyRsbuildConfig'
  | 'onAfterBuild'
  | 'onAfterCreateCompiler'
  | 'onAfterDevCompile'
  | 'onAfterEnvironmentCompile'
  | 'onAfterStartDevServer'
  | 'onAfterStartPreviewServer'
  | 'onBeforeBuild'
  | 'onBeforeCreateCompiler'
  | 'onBeforeDevCompile'
  | 'onBeforeEnvironmentCompile'
  | 'onBeforeStartDevServer'
  | 'onBeforeStartPreviewServer'
  | 'onCloseBuild'
  | 'onCloseDevServer'
  | 'onDevCompileDone'
  | 'onExit'
>;

export type RsbuildTarget = 'web' | 'node' | 'web-worker';

export type RsbuildEntryDescription = Rspack.EntryDescription & {
  /**
   * Whether to generate an HTML file for the entry.
   *
   * @default true
   */
  html?: boolean;
};

export type RsbuildEntry = Record<string, string | string[] | RsbuildEntryDescription>;

export type RsbuildMode = 'development' | 'production' | 'none';

export type RsbuildStatsItem = Pick<
  Rspack.StatsCompilation,
  'errors' | 'warnings' | 'entrypoints' | 'hash'
>;

/**
 * A subset of Rspack's StatsCompilation with only the fields we need
 */
export type RsbuildStats = RsbuildStatsItem & {
  children: RsbuildStatsItem[];
};
