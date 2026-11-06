import fs from 'node:fs';
import { isWebTarget } from '../helpers';
import { isVerbose } from '../logger';
import type { InternalContext, NormalizedConfig, PreviewOptions } from '../types';
import { createAssetsMiddleware } from './assets-middleware/middleware';
import { isCliShortcutsEnabled, setupCliShortcuts } from './cliShortcuts';
import { registerCleanup, removeCleanup, setupGracefulShutdown } from './gracefulShutdown';
import { gzipMiddleware } from './gzipMiddleware';
import {
  getAddressUrls,
  getRoutes,
  getServerTerminator,
  printServerURLs,
  type RsbuildServerBase,
  resolvePort,
  type StartPreviewServerResult,
} from './helper';
import { historyApiFallbackMiddleware } from './historyApiFallback';
import { createHttpServer } from './httpServer';
import {
  faviconFallbackMiddleware,
  getBaseUrlMiddleware,
  getHtmlCompletionMiddleware,
  getHtmlFallbackMiddleware,
  getRequestLoggerMiddleware,
  notFoundMiddleware,
  optionsFallbackMiddleware,
} from './middlewares';
import { open } from './open';
import { getPublicPathnames } from './publicPathnames';
import { createProxyMiddleware } from './proxy';
import { applyServerSetup } from './serverSetup';

export type RsbuildPreviewServer = RsbuildServerBase;

const getPreviewAssetContext = (context: InternalContext): InternalContext => {
  const environmentList = context.environmentList.filter((environment) =>
    isWebTarget(environment.config.output.target),
  );

  return {
    ...context,
    environmentList,
    publicPathnames: environmentList.map(
      (environment) => context.publicPathnames[environment.index],
    ),
  };
};

export async function startPreviewServer(
  context: InternalContext,
  config: NormalizedConfig,
  { getPortSilently }: PreviewOptions = {},
): Promise<StartPreviewServerResult> {
  const { logger } = context;
  const { connect } = await import(/* rspackChunkName: "connect-next" */ 'connect-next');
  const middlewares = connect();

  const { port, portTip } = await resolvePort(config);

  const serverConfig = config.server;
  const { host, headers, proxy, historyApiFallback, compress, base, cors } = serverConfig;

  const assetPrefixes = context.environmentList.map(
    (environment) => environment.config.output.assetPrefix,
  );
  context.publicPathnames = getPublicPathnames(assetPrefixes, base);

  const isHttps = Boolean(serverConfig.https);
  const protocol = isHttps ? 'https' : 'http';
  const routes = getRoutes(context);
  const urls = await getAddressUrls({ protocol, port, host });
  const cliShortcutsEnabled = isCliShortcutsEnabled(config);

  const httpServer = await createHttpServer({
    serverConfig,
    middlewares,
  });

  const cleanupGracefulShutdown = setupGracefulShutdown();
  const serverTerminator = getServerTerminator(httpServer);

  let closingPromise: Promise<void> | null = null;

  const closeServer = async () => {
    if (!closingPromise) {
      closingPromise = (async () => {
        // ensure closeServer is only called once
        removeCleanup(closeServer);
        cleanupGracefulShutdown();
        await serverTerminator();
      })();
    }
    return closingPromise;
  };

  const printUrls = (options?: { showAllRoutes?: boolean }) =>
    printServerURLs({
      urls,
      port,
      routes,
      protocol,
      printUrls: serverConfig.printUrls,
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

  const previewServer: RsbuildPreviewServer = {
    httpServer,
    port,
    middlewares,
    close: closeServer,
    printUrls,
    open: openPage,
  };

  const postSetupCallbacks = await applyServerSetup(serverConfig.setup, {
    action: 'preview',
    server: previewServer,
    environments: context.environments,
  });

  await context.hooks.onBeforeStartPreviewServer.callBatch({
    server: previewServer,
    environments: context.environments,
  });

  const assetContext = getPreviewAssetContext(context);
  const assetsMiddleware = createAssetsMiddleware(assetContext, (callback) => callback(), fs);
  const htmlMiddlewareOptions = {
    assetsMiddleware,
    distPaths: assetContext.environmentList.map((environment) => environment.distPath),
    outputFileSystem: fs,
  };

  if (isVerbose(logger)) {
    middlewares.use(getRequestLoggerMiddleware(logger));
  }

  if (cors) {
    const { default: corsMiddleware } = await import(/* rspackChunkName: "cors" */ 'cors');
    middlewares.use(corsMiddleware(typeof cors === 'boolean' ? {} : cors));
  }

  // apply `server.headers` option
  // `server.headers` can override `server.cors`
  if (headers) {
    middlewares.use((_req, res, next) => {
      for (const [key, value] of Object.entries(headers)) {
        res.setHeader(key, value);
      }
      next();
    });
  }

  // Apply proxy middleware
  // each proxy configuration creates its own middleware instance
  if (proxy) {
    const { middlewares: proxyMiddlewares, upgrade } = await createProxyMiddleware(proxy, logger);

    for (const middleware of proxyMiddlewares) {
      middlewares.use(middleware);
    }

    httpServer.on('upgrade', upgrade);
  }

  // compression is placed after proxy middleware to avoid breaking SSE (Server-Sent Events),
  // but before other middlewares to ensure responses are properly compressed
  if (compress) {
    const { constants } = await import('node:zlib');
    middlewares.use(
      gzipMiddleware({
        // simulates the common gzip compression rates
        level: constants.Z_DEFAULT_COMPRESSION,
        ...(typeof compress === 'object' ? compress : undefined),
      }),
    );
  }

  if (base && base !== '/') {
    middlewares.use(getBaseUrlMiddleware({ base }));
  }

  middlewares.use(assetsMiddleware);
  middlewares.use(getHtmlCompletionMiddleware(htmlMiddlewareOptions));

  if (historyApiFallback) {
    middlewares.use(
      historyApiFallbackMiddleware(logger, historyApiFallback === true ? {} : historyApiFallback),
    );

    // ensure fallback request can be handled by the built asset middleware
    middlewares.use(assetsMiddleware);
  }

  for (const callback of postSetupCallbacks) {
    await callback();
  }

  if (serverConfig.htmlFallback) {
    middlewares.use(
      getHtmlFallbackMiddleware({
        ...htmlMiddlewareOptions,
        logger,
      }),
    );
  }

  middlewares.use(faviconFallbackMiddleware);
  middlewares.use(optionsFallbackMiddleware);
  middlewares.use(notFoundMiddleware);

  return new Promise<StartPreviewServerResult>((resolve) => {
    httpServer.listen(
      {
        host,
        port,
      },
      async () => {
        await context.hooks.onAfterStartPreviewServer.callBatch({
          port,
          routes,
          environments: context.environments,
        });

        registerCleanup(closeServer);
        printUrls();

        if (cliShortcutsEnabled) {
          const shortcutsOptions =
            typeof config.dev.cliShortcuts === 'boolean' ? {} : config.dev.cliShortcuts;

          await setupCliShortcuts({
            openPage,
            closeServer,
            printUrls,
            help: shortcutsOptions.help,
            customShortcuts: shortcutsOptions.custom,
            logger,
          });
        }

        if (!getPortSilently && portTip) {
          logger.info(portTip);
        }

        resolve({
          port,
          urls: urls.map((item) => item.url),
          server: previewServer,
        });
      },
    );
  });
}
