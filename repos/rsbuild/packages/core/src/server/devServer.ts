import type { Server } from 'node:http';
import type { Http2SecureServer } from 'node:http2';
import { color } from '../helpers';
import { getPublicPathFromCompiler, isMultiCompiler } from '../helpers/compiler';
import { onBeforeRestartServer, restartDevServer } from '../restart';
import type {
  CreateCompiler,
  CreateDevServerOptions,
  EnvironmentAPI,
  InternalContext,
  NormalizedConfig,
} from '../types';
import { BuildManager } from './buildManager';
import { isCliShortcutsEnabled, setupCliShortcuts } from './cliShortcuts';
import { createCompileState } from './compileState';
import { type GetDevMiddlewaresResult, getDevMiddlewares } from './devMiddlewares';
import { createCacheableFunction, getTransformedHtml, loadBundle } from './environment';
import { registerCleanup, removeCleanup, setupGracefulShutdown } from './gracefulShutdown';
import {
  getAddressUrls,
  getRoutes,
  getServerTerminator,
  printServerURLs,
  type RsbuildServerBase,
  resolvePort,
  type StartDevServerResult,
} from './helper';
import { createHttpServer } from './httpServer';
import { notFoundMiddleware, optionsFallbackMiddleware } from './middlewares';
import { open } from './open';
import { getPublicPathnames } from './publicPathnames';
import { applyServerSetup } from './serverSetup';
import type { ServerMessage } from './socketServer';
import { setupWatchFiles, type WatchFilesResult } from './watchFiles';

type HTTPServer = Server | Http2SecureServer;

type ExtractSocketMessageData<T extends ServerMessage['type']> = 'data' extends keyof Extract<
  ServerMessage,
  { type: T }
>
  ? Extract<ServerMessage, { type: T }>['data']
  : undefined;

export type HotSend = <T extends ServerMessage['type']>(
  type: T,
  data?: ExtractSocketMessageData<T>,
) => void;

export type RsbuildDevServer = RsbuildServerBase & {
  /**
   * Notifies Rsbuild that the custom server has successfully started.
   * Rsbuild will trigger the `onAfterStartDevServer` hook at this stage.
   */
  afterListen: () => Promise<void>;
  /**
   * Activate socket connection.
   * This ensures that HMR works properly.
   */
  connectWebSocket: (options: { server: HTTPServer }) => void;
  /**
   * Environment API of Rsbuild server.
   */
  environments: EnvironmentAPI;
  /**
   * Start listening on the Rsbuild dev server.
   * Do not call this method if you are using a custom server.
   */
  listen: () => Promise<StartDevServerResult>;
  /**
   * Allows middleware to send some message to HMR client, and then the HMR
   * client will take different actions depending on the message type.
   * - `full-reload`: The page will reload.
   * - `static-changed`: Alias of `full-reload` for backward compatibility.
   * - `custom`: Send custom messages via `custom` type with optional data to the browser and handle them via HMR events.
   */
  sockWrite: HotSend;
};

export async function createDevServer<
  Options extends {
    context: InternalContext;
  },
>(
  options: Options,
  createCompiler: CreateCompiler,
  config: NormalizedConfig,
  { getPortSilently, runCompile = true }: CreateDevServerOptions = {},
): Promise<RsbuildDevServer> {
  const { context } = options;
  const { logger } = context;
  logger.debug('create dev server');

  const { port, portTip } = await resolvePort(config);
  const { middlewareMode, host } = config.server;
  const isHttps = Boolean(config.server.https);
  const routes = getRoutes(context);

  // SSR or backend-integrated apps may not generate HTML upfront. In that case,
  // keep printing the dev server base URL for web targets so users still get
  // a meaningful address, while node targets stay silent.
  const fallbackPathname =
    routes.length === 0 &&
    context.environmentList.some((item) => item.config.output.target === 'web')
      ? config.server.base
      : undefined;

  context.devServer = {
    hostname: host,
    port,
    https: isHttps,
  };

  const compileState = createCompileState(context.environmentList.length);

  const startCompile: () => Promise<BuildManager> = async () => {
    const compiler = await createCompiler();

    if (!compiler) {
      throw new Error(`${color.dim('[rsbuild:server]')} Failed to get compiler instance.`);
    }

    const publicPaths = isMultiCompiler(compiler)
      ? compiler.compilers.map(getPublicPathFromCompiler)
      : [getPublicPathFromCompiler(compiler)];

    context.publicPathnames = getPublicPathnames(publicPaths, config.server.base);

    const hookOptions = {
      name: 'rsbuild:environment-api',
      // Reset API state before user watchRun hooks can read stale environment stats.
      stage: -10000,
    };
    if (isMultiCompiler(compiler)) {
      compiler.compilers.forEach((compiler, index) => {
        compiler.hooks.watchRun.tap(hookOptions, () => {
          compileState.reset(index);
        });
        compiler.hooks.done.tap(hookOptions, (stats) => {
          compileState.done(index, stats);
        });
      });
    } else {
      compiler.hooks.watchRun.tap(hookOptions, () => {
        compileState.reset(0);
      });
      compiler.hooks.done.tap(hookOptions, (stats) => {
        compileState.done(0, stats);
      });
    }

    const buildManager = new BuildManager({
      context,
      config,
      compiler,
      resolvedPort: port,
    });

    await buildManager.init();

    return buildManager;
  };

  const protocol = isHttps ? 'https' : 'http';
  const urls = await getAddressUrls({ protocol, port, host });

  const cliShortcutsEnabled = isCliShortcutsEnabled(config);

  const printUrls = (options?: { showAllRoutes?: boolean }) =>
    printServerURLs({
      urls,
      port,
      routes,
      protocol,
      printUrls: config.server.printUrls,
      fallbackPathname,
      showAllRoutes: options?.showAllRoutes,
      cliShortcutsEnabled,
      originalConfig: context.originalConfig,
      logger,
    });

  const openPage = async () => {
    return open({
      port,
      routes,
      config,
      protocol,
      clearCache: true,
      logger,
    });
  };

  const state: {
    fileWatcher?: WatchFilesResult;
    devMiddlewares?: GetDevMiddlewaresResult;
    buildManager?: BuildManager;
  } = {};

  const cleanupGracefulShutdown = middlewareMode ? null : setupGracefulShutdown();

  let closingPromise: Promise<void> | null = null;

  const closeServer = async () => {
    if (!closingPromise) {
      closingPromise = (async () => {
        // ensure closeServer is only called once
        removeCleanup(closeServer);
        cleanupGracefulShutdown?.();
        await context.hooks.onCloseDevServer.callBatch();
        await Promise.all([state.devMiddlewares?.close(), state.fileWatcher?.close()]);
      })();
    }
    return closingPromise;
  };

  if (!middlewareMode) {
    registerCleanup(closeServer);
  }

  const beforeCreateCompiler = async () => {
    printUrls();

    if (cliShortcutsEnabled) {
      const shortcutsOptions =
        typeof config.dev.cliShortcuts === 'boolean' ? {} : config.dev.cliShortcuts;

      const cleanup = await setupCliShortcuts({
        openPage,
        closeServer,
        printUrls,
        restartServer: () => restartDevServer({ clear: false, logger }),
        help: shortcutsOptions.help,
        customShortcuts: shortcutsOptions.custom,
        logger,
      });
      context.hooks.onCloseDevServer.tap(cleanup);
    }

    if (!getPortSilently && portTip) {
      logger.info(portTip);
    }
  };

  const cacheableLoadBundle = createCacheableFunction(loadBundle);
  const cacheableTransformedHtml = createCacheableFunction<string>((_stats, entryName, utils) =>
    getTransformedHtml(entryName, utils),
  );

  const environmentAPI: EnvironmentAPI = {};
  const createHotSend =
    (token?: string): HotSend =>
    (type, data) =>
      state.buildManager?.socketServer.sendMessage(
        {
          type,
          data,
        } as ServerMessage,
        token,
      );

  const getErrorMsg = (method: string) =>
    `${color.dim('[rsbuild:server]')} Can not call ` +
    `${color.yellow(method)} when ` +
    `${color.yellow('runCompile')} is false`;

  context.environmentList.forEach((environment, index) => {
    environmentAPI[environment.name] = {
      context: environment,
      hot: {
        send: createHotSend(environment.webSocketToken),
      },
      getStats: async () => {
        if (!state.buildManager) {
          throw new Error(getErrorMsg('getStats'));
        }
        return compileState.wait(index);
      },
      loadBundle: async <T>(entryName: string) => {
        if (!state.buildManager) {
          throw new Error(getErrorMsg('loadBundle'));
        }
        const stats = await compileState.wait(index);
        return cacheableLoadBundle(stats, entryName, {
          readFileSync: state.buildManager.readFileSync,
          environment,
        }) as T;
      },
      getTransformedHtml: async (entryName: string) => {
        if (!state.buildManager) {
          throw new Error(getErrorMsg('getTransformedHtml'));
        }
        const stats = await compileState.wait(index);
        return cacheableTransformedHtml(stats, entryName, {
          readFileSync: state.buildManager.readFileSync,
          environment,
        });
      },
    };
  });

  const { connect } = await import(/* rspackChunkName: "connect-next" */ 'connect-next');
  const middlewares = connect();

  const httpServer = middlewareMode
    ? null
    : await createHttpServer({
        serverConfig: config.server,
        middlewares,
      });

  const sockWrite = createHotSend();

  const devServer: RsbuildDevServer = {
    port,
    middlewares,
    environments: environmentAPI,
    httpServer,
    sockWrite,
    listen: async () => {
      if (!httpServer) {
        throw new Error(
          `${color.dim('[rsbuild:server]')} Can not listen dev server as ` +
            `${color.yellow('server.middlewareMode')} is enabled.`,
        );
      }

      const serverTerminator = getServerTerminator(httpServer);
      logger.debug('listen dev server');

      context.hooks.onCloseDevServer.tap(serverTerminator);

      return new Promise<StartDevServerResult>((resolve) => {
        httpServer.listen(
          {
            host,
            port,
          },
          async (err?: Error) => {
            if (err) {
              throw err;
            }

            // OPTIONS request fallback middleware
            // Should register this middleware as the last
            // see: https://github.com/web-infra-dev/rsbuild/pull/2867
            middlewares.use(optionsFallbackMiddleware);

            // 404 fallback middleware should be the last middleware
            middlewares.use(notFoundMiddleware);

            if (state.devMiddlewares) {
              httpServer.on('upgrade', state.devMiddlewares.onUpgrade);
            }

            logger.debug('listen dev server done');

            await devServer.afterListen();

            onBeforeRestartServer(devServer.close);

            resolve({
              port,
              urls: urls.map((item) => item.url),
              server: devServer,
            });
          },
        );
      });
    },
    afterListen: async () => {
      await context.hooks.onAfterStartDevServer.callBatch({
        port,
        routes,
        environments: context.environments,
      });
    },
    connectWebSocket: ({ server }: { server: HTTPServer }) => {
      if (state.devMiddlewares) {
        server.on('upgrade', state.devMiddlewares.onUpgrade);
      }
    },
    close: closeServer,
    printUrls,
    open: openPage,
  };

  const setupPostCallbacks = await applyServerSetup(config.server.setup, {
    action: 'dev',
    server: devServer,
    environments: context.environments,
  });

  const hookPostCallbacks = (
    await context.hooks.onBeforeStartDevServer.callBatch({
      server: devServer,
      environments: context.environments,
    })
  ).filter((item) => typeof item === 'function');

  const postCallbacks = [...hookPostCallbacks, ...setupPostCallbacks];

  if (runCompile) {
    // print server url should between listen and beforeCompile
    context.hooks.onBeforeCreateCompiler.tap(beforeCreateCompiler);
  } else {
    await beforeCreateCompiler();
  }

  state.buildManager = runCompile ? await startCompile() : undefined;

  state.fileWatcher = await setupWatchFiles({
    config,
    buildManager: state.buildManager,
    root: context.rootPath,
  });

  state.devMiddlewares = await getDevMiddlewares({
    buildManager: state.buildManager,
    config,
    devServer,
    context,
    postCallbacks,
  });

  // start watching
  state.buildManager?.watch();

  logger.debug('create dev server done');

  return devServer;
}
