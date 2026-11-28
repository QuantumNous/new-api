import type { RequestHandler } from 'http-proxy-middleware';
import { color } from '../helpers';
import type { Logger } from '../logger';
import type { RequestHandler as Middleware, ProxyConfig, ProxyOptions } from '../types';
import { HttpCode, type UpgradeEvent } from './helper';

function formatProxyOptions(proxyOptions: ProxyConfig, logger: Logger) {
  const logPrefix = color.dim('[http-proxy-middleware]: ');
  const defaultOptions: ProxyOptions = {
    changeOrigin: true,
    logger: {
      info(msg: string) {
        logger.debug(logPrefix + msg);
      },
      warn: (msg: string) => {
        logger.warn(logPrefix + msg);
      },
      error: (msg: string) => {
        logger.error(logPrefix + msg);
      },
    },
  };

  if (Array.isArray(proxyOptions)) {
    return proxyOptions.map((options) => ({
      ...defaultOptions,
      ...options,
    }));
  }

  return Object.entries(proxyOptions).map(([pathFilter, value]) => ({
    ...defaultOptions,
    pathFilter,
    ...(typeof value === 'string' ? { target: value } : value),
  }));
}

export async function createProxyMiddleware(
  proxyOptions: ProxyConfig,
  logger: Logger,
): Promise<{
  middlewares: Middleware[];
  upgrade: UpgradeEvent;
}> {
  // If it is not an array, it may be an object that uses the context attribute
  // or an object in the form of { source: ProxyDetail }
  const formattedOptions = formatProxyOptions(proxyOptions, logger);
  const proxyMiddlewares: RequestHandler[] = [];
  const middlewares: Middleware[] = [];

  const { createProxyMiddleware: baseMiddleware } = await import(
    /* rspackChunkName: "http-proxy-middleware" */ 'http-proxy-middleware'
  );

  for (const opts of formattedOptions) {
    const proxyMiddleware = baseMiddleware(opts);

    const middleware: Middleware = async (req, res, next) => {
      const bypassUrl =
        typeof opts.bypass === 'function' ? await opts.bypass(req, res, opts) : null;

      if (bypassUrl === false) {
        res.statusCode = HttpCode.NotFound;
        next();
      } else if (typeof bypassUrl === 'string') {
        req.url = bypassUrl;
        next();
      } else if (bypassUrl === true) {
        next();
      } else {
        (proxyMiddleware as Middleware)(req, res, next);
      }
    };

    middlewares.push(middleware);

    // only proxy WebSocket request when user specified
    // fix WebSocket error when user forget filter HMR path
    if (opts.ws) {
      proxyMiddlewares.push(proxyMiddleware);
    }
  }

  const handleUpgrade: UpgradeEvent = (req, socket, head) => {
    for (const middleware of proxyMiddlewares) {
      if (typeof middleware.upgrade === 'function') {
        middleware.upgrade(req, socket, head);
      }
    }
  };

  return {
    middlewares,
    upgrade: handleUpgrade,
  };
}
