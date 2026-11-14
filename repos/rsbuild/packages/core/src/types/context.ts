import type { Hooks } from '../hooks';
import type { Logger } from '../logger';
import type { SocketServer } from '../server/socketServer';
import type { NormalizedConfig, RsbuildConfig } from './config';
import type { EnvironmentContext } from './hooks';
import type { RsbuildPluginAPI } from './plugin';
import type { RsbuildStats } from './rsbuild';

export type BundlerType = 'rspack';

export type ActionType = 'dev' | 'build' | 'preview';

/** The public context */
export type RsbuildContext = {
  /** The Rsbuild core version. */
  version: string;
  /** The root path of current project. */
  rootPath: string;
  /** Absolute path of output files. */
  distPath: string;
  /** Absolute path of cache files. */
  cachePath: string;
  /**
   * Dev server information when running in dev mode.
   * Available after the dev server has been created.
   *
   * @example
   * ```ts
   * import { createRsbuild } from '@rsbuild/core';
   *
   * async function main() {
   *   const rsbuild = createRsbuild({
   *     // ...
   *   });
   *   await rsbuild.startDevServer();
   *   console.log(rsbuild.context.devServer);
   *   // { hostname: 'localhost', port: 3000, https: false }
   * }
   * ```
   */
  devServer?: {
    /** The hostname the server is running on. */
    hostname: string;
    /** The actual port number the server is listening on. */
    port: number;
    /** Whether the server is using HTTPS protocol. */
    https: boolean;
  };
  /**
   * The current action type.
   * - dev: will be set when running `rsbuild dev` or `rsbuild.startDevServer()`
   * - build: will be set when running `rsbuild build` or `rsbuild.build()`
   * - preview: will be set when running `rsbuild preview` or `rsbuild.preview()`
   */
  action?: ActionType;
  /**
   * The bundler type, currently only `rspack` is supported.
   * @deprecated Do not use this field, it will be removed in future versions.
   */
  bundlerType: BundlerType;
  /**
   * The name of the framework or tool that is currently invoking Rsbuild,
   * same as the `callerName` option in the `createRsbuild` method.
   * @example
   * - `rslib` is set when Rslib calls Rsbuild.
   * - `rspress` is set when Rspress calls Rsbuild.
   */
  callerName: string;
};

export type BuildStatus = 'idle' | 'building' | 'done';

export type BuildState = {
  /**
   * The stats object of the last build.
   * Available after the build has been done.
   */
  stats: RsbuildStats | null;
  /** Current build status */
  status: BuildStatus;
  /** Whether there are build errors */
  hasErrors: boolean;
  /** The build time of each environment */
  time: Record<string, number>;
};

/** The inner context. */
export type InternalContext = RsbuildContext & {
  /** The logger associated with current Rsbuild instance. */
  logger: Logger;
  /** All hooks. */
  hooks: Readonly<Hooks>;
  /** Current Rsbuild config. */
  config: Readonly<RsbuildConfig>;
  /** The original Rsbuild config passed from the createRsbuild method. */
  originalConfig: Readonly<RsbuildConfig>;
  /** The normalized Rsbuild config. */
  normalizedConfig?: NormalizedConfig;
  /**
   * Get the plugin API.
   * When environment is undefined, the global plugin API is returned, which
   * can be used in all environments.
   */
  getPluginAPI?: (environment?: string) => RsbuildPluginAPI;
  /** Context information for all environments. */
  environments: Record<string, EnvironmentContext>;
  /** Array of all environments. */
  environmentList: EnvironmentContext[];
  /** Only build specified environment. */
  specifiedEnvironments?: string[];
  /** Build state information */
  buildState: BuildState;
  /** The socket server instance. */
  socketServer?: SocketServer;
  /**
   * Pathnames derived from public paths, stripped of `server.base`.
   * Used for static asset serving.
   */
  publicPathnames: string[];
};
