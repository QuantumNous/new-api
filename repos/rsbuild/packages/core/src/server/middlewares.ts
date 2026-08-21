import type { IncomingMessage } from 'node:http';
import path from 'node:path';
import onFinished from 'on-finished';
import { color } from '../helpers';
import { addTrailingSlash } from '../helpers/url';
import { isVerbose, type Logger } from '../logger';
import type { Connect, EnvironmentAPI, RequestHandler, Rspack } from '../types';
import { HttpCode, isUrlPathUnderBase, joinUrlPath, removeBasePath } from './helper';

export const faviconFallbackMiddleware: RequestHandler = (req, res, next) => {
  if (req.url === '/favicon.ico') {
    res.statusCode = 204;
    res.end();
  } else {
    next();
  }
};

const getStatusCodeColor = (status: number) => {
  if (status >= 500) {
    return color.red;
  }
  if (status >= 400) {
    return color.yellow;
  }
  if (status >= 300) {
    return color.cyan;
  }
  if (status >= 200) {
    return color.green;
  }
  return (res: number) => res;
};

export const getRequestLoggerMiddleware = (logger: Logger): Connect.NextHandleFunction => {
  return (req, res, next) => {
    const _startAt = process.hrtime();

    const logRequest = () => {
      const method = req.method;
      const url = req.originalUrl || req.url;
      const status = Number(res.statusCode);

      // get status color
      const statusColor = getStatusCodeColor(status);

      const endAt = process.hrtime();

      const totalTime = (endAt[0] - _startAt[0]) * 1e3 + (endAt[1] - _startAt[1]) * 1e-6;

      // :status :method :url :total-time ms
      logger.debug(
        `${statusColor(status)} ${method} ${url} ${color.dim(`${totalTime.toFixed(3)} ms`)}`,
      );
    };

    onFinished(res, logRequest);

    next();
  };
};

export const notFoundMiddleware: RequestHandler = (_req, res, _next) => {
  res.statusCode = HttpCode.NotFound;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end('This page could not be found');
};

export const optionsFallbackMiddleware: RequestHandler = (req, res, next) => {
  if (req.method === 'OPTIONS') {
    // Use 204 as no content to send in the response body
    res.statusCode = 204;
    res.setHeader('Content-Length', '0');
    res.end();
    return;
  }
  next();
};

const isFileExists = async (
  filePath: string,
  outputFileSystem: Rspack.OutputFileSystem,
): Promise<boolean> =>
  new Promise((resolve) => {
    outputFileSystem.stat(filePath, (_error, stats) => {
      resolve(Boolean(stats?.isFile()));
    });
  });

const isFileExistsInDistPaths = async (
  distPaths: string[],
  filename: string,
  outputFileSystem: Rspack.OutputFileSystem,
): Promise<boolean> => {
  for (const distPath of distPaths) {
    if (await isFileExists(path.join(distPath, filename), outputFileSystem)) {
      return true;
    }
  }
  return false;
};

const maybeHTMLRequest = (req: IncomingMessage) => {
  if (
    // require headers and url
    !req.url ||
    !req.headers ||
    // only accept GET or HEAD
    (req.method !== 'GET' && req.method !== 'HEAD')
  ) {
    return false;
  }

  const { accept } = req.headers;
  // accept should be `text/html` or `*/*`
  return typeof accept === 'string' && (accept.includes('text/html') || accept.includes('*/*'));
};

const postfixRE = /[?#].*$/;

const getUrlPathname = (url: string): string => {
  return url.replace(postfixRE, '');
};

type HtmlAssetsMiddlewareOptions = {
  distPaths: string[];
  assetsMiddleware: RequestHandler;
  outputFileSystem: Rspack.OutputFileSystem;
};

/**
 * Support access HTML without suffix
 */
export const getHtmlCompletionMiddleware: (
  params: HtmlAssetsMiddlewareOptions,
) => RequestHandler = ({ distPaths, assetsMiddleware, outputFileSystem }) => {
  return async function htmlCompletionMiddleware(req, res, next) {
    if (!maybeHTMLRequest(req)) {
      next();
      return;
    }

    const url = req.url!;
    const pathname = getUrlPathname(url);

    const rewrite = (newUrl: string) => {
      req.url = newUrl;
      assetsMiddleware(req, res, (...args) => {
        next(...args);
      });
      return;
    };

    // '/' => '/index.html'
    if (pathname.endsWith('/')) {
      const newUrl = `${pathname}index.html`;

      if (await isFileExistsInDistPaths(distPaths, newUrl, outputFileSystem)) {
        rewrite(newUrl);
        return;
      }
    }
    // '/main' => '/main.html'
    else if (!path.extname(pathname)) {
      const newUrl = `${pathname}.html`;

      if (await isFileExistsInDistPaths(distPaths, newUrl, outputFileSystem)) {
        rewrite(newUrl);
        return;
      }
    }

    next();
  };
};

/**
 * handle `server.base`
 */
export const getBaseUrlMiddleware: (params: { base: string }) => RequestHandler = ({ base }) => {
  return function baseUrlMiddleware(req, res, next) {
    const url = req.url!;
    const pathname = getUrlPathname(url);

    if (isUrlPathUnderBase(pathname, base)) {
      req.url = removeBasePath(url, base);
      next();
      return;
    }

    const redirectPath = addTrailingSlash(url) !== base ? joinUrlPath(base, url) : base;

    if (pathname === '/' || pathname === '/index.html') {
      // redirect root visit to based url with search and hash
      res.writeHead(302, {
        Location: redirectPath,
      });
      res.end();
      return;
    }

    // non-based page visit
    if (req.headers.accept?.includes('text/html')) {
      res.writeHead(HttpCode.NotFound, {
        'Content-Type': 'text/html',
      });
      res.end(
        `The server is configured with a base URL of ${base} - ` +
          `did you mean to visit <a href="${redirectPath}">${redirectPath}</a> instead?`,
      );
      return;
    }

    // not found for resources
    res.writeHead(HttpCode.NotFound, {
      'Content-Type': 'text/plain',
    });
    res.end(
      `The server is configured with a base URL of ${base} - ` +
        `did you mean to visit ${redirectPath} instead?`,
    );
    return;
  };
};

/**
 * support HTML fallback in some edge cases
 */
export const getHtmlFallbackMiddleware: (
  params: HtmlAssetsMiddlewareOptions & { logger: Logger },
) => RequestHandler = ({ distPaths, assetsMiddleware, outputFileSystem, logger }) => {
  return async function htmlFallbackMiddleware(req, res, next) {
    if (!maybeHTMLRequest(req) || '/favicon.ico' === req.url) {
      next();
      return;
    }

    if (await isFileExistsInDistPaths(distPaths, 'index.html', outputFileSystem)) {
      const newUrl = '/index.html';

      if (isVerbose(logger)) {
        logger.debug(`    ${req.method} ${req.url} ${color.yellow('fallback to')} ${newUrl}`);
      }

      req.url = newUrl;
      assetsMiddleware(req, res, (...args) => {
        next(...args);
      });
      return;
    }

    next();
  };
};

/**
 * Support viewing served files via `/rsbuild-dev-server` route
 */
export const viewingServedFilesMiddleware: (params: {
  environments: EnvironmentAPI;
  logger: Logger;
}) => RequestHandler = ({ environments, logger }) =>
  async function viewingServedFilesMiddleware(req, res, next) {
    const url = req.url!;
    const pathname = getUrlPathname(url);

    if (pathname !== '/rsbuild-dev-server') {
      next();
      return;
    }

    res.writeHead(HttpCode.Ok, { 'Content-Type': 'text/html; charset=utf-8' });
    res.write(
      `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body {
        margin: 0;
        color: #f6f7f9;
        padding: 32px 40px;
        line-height: 1.8;
        min-height: 100vh;
        background-image: linear-gradient(#020917, #101725);
        font-family: ui-sans-serif,system-ui,sans-serif;
      }
      h1, h2 {
        font-weight: 500;
      }
      h1 {
        margin: 0;
        font-size: 36px;
      }
      h2 {
        font-size: 20px;
        margin: 24px 0 16px;
      }
      ul {
        margin: 0;
        padding-left: 16px;
      }
      a {
        color: #58c4dc;
        text-decoration: none;
      }
      a:hover {
        text-decoration: underline;
      }
    </style>
  </head>
  <body>
    <h1>Assets Report</h1>
  </body>
</html>`,
    );

    try {
      for (const key in environments) {
        res.write(`<h2>Environment: ${key}</h2>`);

        const list = [];
        const environment = environments[key];
        const stats = await environment.getStats();
        const assets = Object.keys(stats.compilation.assets);

        res.write('<ul>');

        for (const asset of assets) {
          list.push(`<li><a target="_blank" href="${asset}">${asset}</a></li>`);
        }

        res.write(list?.join(''));
        res.write('</ul>');
      }
      res.end('</body></html>');
    } catch (err) {
      logger.error(err);
      res.writeHead(500);
      res.end('Failed to list the files');
    }
  };
