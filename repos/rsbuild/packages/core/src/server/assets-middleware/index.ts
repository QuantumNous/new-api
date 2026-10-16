/**
 * The assets middleware is modified based on
 * https://github.com/webpack/webpack-dev-middleware
 *
 * MIT Licensed
 * Copyright JS Foundation and other contributors
 * https://github.com/webpack/webpack-dev-middleware/blob/master/LICENSE
 */

import { isAbsolute, join } from 'node:path';
import { type Compiler, type MultiCompiler, rspack, type Watching } from '@rspack/core';
import { CLIENT_PATH } from '../../constants';
import { createVirtualModule, pick } from '../../helpers';
import { applyToCompiler, isMultiCompiler } from '../../helpers/compiler';
import { isOverlayEnabled } from '../../helpers/overlayConfig';
import { toPosixPath } from '../../helpers/path';
import type {
  InternalContext,
  LiveReload,
  NormalizedConfig,
  NormalizedEnvironmentConfig,
  RequestHandler,
  Rspack,
} from '../../types';
import { resolveHostname } from './../hmrFallback';
import type { SocketServer } from '../socketServer';
import { createAssetsMiddleware } from './middleware';
import { setupOutputFileSystem } from './setupOutputFileSystem';
import { resolveWriteToDiskConfig, setupWriteToDisk } from './setupWriteToDisk';

const noop = () => {};

export type MultiWatching = ReturnType<MultiCompiler['watch']>;

export type AssetsMiddlewareClose = (callback: (err?: Error | null) => void) => void;

export type AssetsMiddleware = RequestHandler & {
  watch: () => void;
  close: AssetsMiddlewareClose;
};

type NormalizedLiveReload = {
  enabled: boolean;
  html: boolean;
};

const normalizeLiveReload = (liveReload: LiveReload): NormalizedLiveReload => {
  if (typeof liveReload === 'boolean') {
    return { enabled: liveReload, html: liveReload };
  }
  return {
    enabled: true,
    html: liveReload.html !== false,
  };
};

export const isClientCompiler = (compiler: Compiler): boolean => {
  const { target } = compiler.options;
  if (target) {
    return Array.isArray(target) ? target.includes('web') : target === 'web';
  }
  return false;
};

const isNodeCompiler = (compiler: Compiler) => {
  const { target } = compiler.options;
  if (target) {
    return Array.isArray(target) ? target.includes('node') : target === 'node';
  }
  return false;
};

const isTsError = (error: Rspack.RspackError) =>
  'message' in error && error.stack?.includes('ts-checker-rspack-plugin');

export const setupServerHooks = ({
  context,
  compiler,
  token,
  socketServer,
  liveReload,
}: {
  context: InternalContext;
  compiler: Compiler;
  token: string;
  socketServer: SocketServer;
  liveReload: LiveReload;
}): void => {
  // Node HMR is not supported yet
  if (isNodeCompiler(compiler)) {
    return;
  }

  // Track errors and warnings count to detect if the `done` hook is called multiple times
  let errorsCount: number | null = null;
  let warningsCount: number | null = null;

  compiler.hooks.invalid.tap('rsbuild-dev-server', (fileName) => {
    errorsCount = null;
    warningsCount = null;

    // reload page when HTML template changed
    if (
      typeof fileName === 'string' &&
      fileName.endsWith('.html') &&
      normalizeLiveReload(liveReload).html
    ) {
      socketServer.sendMessage({ type: 'full-reload' }, token);
    }
  });

  compiler.hooks.done.tap('rsbuild-dev-server', (stats) => {
    const { errors, warnings } = stats.compilation;
    if (errors.length === errorsCount && warnings.length === warningsCount) {
      return;
    }

    const isRecalled = errorsCount !== null || warningsCount !== null;
    errorsCount = errors.length;
    warningsCount = warnings.length;

    /**
     * The ts-checker-rspack-plugin asynchronously pushes Type errors and warnings
     * to `compilation.errors` and `compilation.warnings` and calls the `done` hook
     * again, so we need to detect changes in errors/warnings and render them in the
     * overlay or browser console.
     */
    if (isRecalled) {
      const tsErrors = errors.filter(isTsError);
      const tsWarnings = warnings.filter(isTsError);

      if (!tsErrors.length && !tsWarnings.length) {
        return;
      }

      const { stats: statsJson } = context.buildState;

      const handleTsIssues = (
        issues: Rspack.RspackError[],
        type: 'errors' | 'warnings',
        sendFn: (issues: Rspack.StatsError[], token: string) => void,
      ) => {
        const statsIssues = issues.map((item) => pick(item, ['message', 'file']));

        if (statsJson) {
          statsJson[type] = statsJson[type] ? [...statsJson[type], ...statsIssues] : statsIssues;
        }

        sendFn(statsIssues, token);
      };

      if (tsErrors.length > 0) {
        handleTsIssues(tsErrors, 'errors', (issues, token) => {
          socketServer.sendError(issues, token);
        });
        return;
      }

      if (tsWarnings.length > 0) {
        handleTsIssues(tsWarnings, 'warnings', (issues, token) => {
          socketServer.sendWarning(issues, token);
        });
        return;
      }
    }
  });
};

function applyHMREntry({
  config,
  compiler,
  token,
  resolvedHost,
  resolvedPort,
}: {
  config: NormalizedEnvironmentConfig;
  compiler: Compiler;
  token: string;
  resolvedHost: string;
  resolvedPort: number;
}) {
  if (!isClientCompiler(compiler) || (!config.dev.hmr && !config.dev.liveReload)) {
    return;
  }

  const { enabled: liveReloadEnabled } = normalizeLiveReload(config.dev.liveReload);

  const { webSocketUrlResolver, ...clientConfig } = { ...config.dev.client };
  if (clientConfig.port === '<port>') {
    clientConfig.port = resolvedPort;
  }

  const resolverPath =
    webSocketUrlResolver && !isAbsolute(webSocketUrlResolver)
      ? join(compiler.context, webSocketUrlResolver)
      : webSocketUrlResolver;

  const hmrEntry = `import { init } from '${toPosixPath(join(CLIENT_PATH, 'hmr.js'))}';
${isOverlayEnabled(config.dev.client.overlay) ? `import '${toPosixPath(join(CLIENT_PATH, 'overlay.js'))}';` : ''}
${resolverPath ? `import urlResolver from ${JSON.stringify(toPosixPath(resolverPath))};` : ''}
init(
  '${token}',
  ${JSON.stringify(clientConfig)},
  ${JSON.stringify(resolvedHost)},
  ${resolvedPort},
  ${JSON.stringify(config.server.base)},
  ${liveReloadEnabled},
  ${Boolean(config.dev.browserLogs)},
  ${JSON.stringify(config.dev.client.logLevel)}${resolverPath ? ',\n  urlResolver' : ''}
)
`;

  new rspack.EntryPlugin(compiler.context, createVirtualModule(hmrEntry), {
    name: undefined,
  }).apply(compiler);
}

/**
 * The assets middleware handles compiler setup for development:
 * - Call `compiler.watch`
 * - Inject the HMR client path into page
 * - Notify server when compiler hooks are triggered
 */
export const assetsMiddleware = async ({
  config,
  compiler,
  context,
  socketServer,
  resolvedPort,
}: {
  config: NormalizedConfig;
  compiler: Compiler | MultiCompiler;
  context: InternalContext;
  socketServer: SocketServer;
  resolvedPort: number;
}): Promise<AssetsMiddleware> => {
  const { logger } = context;
  const resolvedHost = await resolveHostname(config.server.host);
  const { environments, environmentList } = context;

  const setupCompiler = (compiler: Compiler, index: number) => {
    const environment = environmentList[index];
    if (!environment) {
      return;
    }

    const token = environment.webSocketToken;
    if (!token) {
      return;
    }

    applyHMREntry({
      token,
      config: environment.config,
      compiler,
      resolvedHost,
      resolvedPort,
    });

    // register hooks for each compilation, update socket stats if recompiled
    setupServerHooks({
      context,
      compiler,
      socketServer,
      token,
      liveReload: environment.config.dev.liveReload,
    });
  };

  applyToCompiler(compiler, setupCompiler);

  const compilers = isMultiCompiler(compiler) ? compiler.compilers : [compiler];
  const callbacks: (() => void)[] = [];

  compiler.hooks.done.tap('rsbuild-dev-middleware', () => {
    process.nextTick(() => {
      if (!(context.buildState.status === 'done')) {
        return;
      }

      callbacks.forEach((callback) => {
        callback();
      });
      callbacks.length = 0;
    });
  });

  const writeToDisk = resolveWriteToDiskConfig(config.dev, environments, environmentList);
  if (writeToDisk) {
    setupWriteToDisk(compilers, writeToDisk, logger);
  }

  const outputFileSystem = await setupOutputFileSystem(writeToDisk, compilers);

  const ready = (callback: () => void) => {
    if (context.buildState.status === 'done') {
      callback();
    } else {
      callbacks.push(callback);
    }
  };

  const instance = createAssetsMiddleware(context, ready, outputFileSystem) as AssetsMiddleware;

  let watching: Watching | MultiWatching | undefined;

  // API
  instance.watch = () => {
    if (compiler.watching) {
      watching = compiler.watching;
    } else {
      const watchOptions =
        compilers.length > 1
          ? compilers.map(({ options }) => options.watchOptions || {})
          : compilers[0].options.watchOptions || {};

      watching = compiler.watch(watchOptions, (error) => {
        if (error) {
          if (error.message?.includes('× Error:')) {
            error.message = error.message.replace('× Error:', '').trim();
          }
          logger.error(error);
        }
      });
    }
  };

  instance.close = ((callback = noop) => {
    watching?.close(callback);
  }) satisfies AssetsMiddlewareClose;

  return instance;
};
