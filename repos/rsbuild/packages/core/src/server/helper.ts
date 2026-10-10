import type { IncomingMessage, Server } from 'node:http';
import type { Http2SecureServer } from 'node:http2';
import type { Socket } from 'node:net';
import os from 'node:os';
import { posix, relative, sep } from 'node:path';
import { ALL_INTERFACES_IPV4, LOCALHOST } from '../constants';
import { color, isFunction } from '../helpers';
import { getCommonParentPath } from '../helpers/path';
import { addTrailingSlash, removeLeadingSlash, removeTailingSlash } from '../helpers/url';
import type { Logger } from '../logger';
import type {
  Connect,
  InternalContext,
  NormalizedConfig,
  OutputStructure,
  PrintUrls,
  PrintUrlsOptions,
  Routes,
  RsbuildConfig,
  RsbuildEntry,
} from '../types';
import type { RsbuildDevServer } from './devServer';
import type { RsbuildPreviewServer } from './previewServer';

/**
 * It used to subscribe http upgrade event
 */
export type UpgradeEvent = (req: IncomingMessage, socket: Socket, head: any) => void;

export type ServerStartResult<T> = {
  /**
   * The URLs that server is listening on.
   */
  urls: string[];
  /**
   * The actual port used by the server.
   */
  port: number;
  /**
   * The dev server or preview server instance.
   */
  server: T;
};

export type StartDevServerResult = ServerStartResult<RsbuildDevServer>;

export type StartPreviewServerResult = ServerStartResult<RsbuildPreviewServer>;

// remove repeat '/'
export const normalizeUrl = (url: string): string => url.replace(/([^:]\/)\/+/g, '$1');

/**
 * Make sure there is slash before and after prefix
 */
const formatPrefix = (input: string | undefined) => {
  let prefix = input;

  if (prefix?.startsWith('./')) {
    prefix = prefix.replace('./', '');
  }

  if (!prefix) {
    return '/';
  }

  const hasLeadingSlash = prefix.startsWith('/');
  const hasTailSlash = prefix.endsWith('/');
  return `${hasLeadingSlash ? '' : '/'}${prefix}${hasTailSlash ? '' : '/'}`;
};

// /a + /b => /a/b
export const joinUrlPath = (basePath: string, pathname: string): string => {
  if (basePath === '') {
    return pathname;
  }

  if (pathname === '') {
    return basePath;
  }

  return addTrailingSlash(basePath) + removeLeadingSlash(pathname);
};

const DEFAULT_MAX_ROUTES = 10;

const normalizeMaxRoutes = (maxRoutes: number | undefined): number => {
  if (maxRoutes === undefined) {
    return DEFAULT_MAX_ROUTES;
  }

  if (maxRoutes === Number.POSITIVE_INFINITY) {
    return maxRoutes;
  }

  return Math.max(0, Math.floor(maxRoutes));
};

const getPrintUrlsOptions = (printUrls: PrintUrls | undefined): PrintUrlsOptions => {
  if (printUrls && typeof printUrls === 'object') {
    return printUrls;
  }

  return {};
};

const getMoreEntriesMessage = (moreEntries: number, cliShortcutsEnabled: boolean): string => {
  if (cliShortcutsEnabled) {
    return `  ${color.dim(`... ${moreEntries} more entries, press `)}${color.bold(
      'u + enter',
    )}${color.dim(' to show all')}\n`;
  }

  return `  ${color.dim(`... ${moreEntries} more entries, set `)}${color.bold(
    'server.printUrls.maxRoutes',
  )}${color.dim(' to show more')}\n`;
};

export const isUrlPathUnderBase = (pathname: string, base: string): boolean => {
  const basePath = removeTailingSlash(base);
  return basePath === '' || pathname === basePath || pathname.startsWith(`${basePath}/`);
};

export const removeBasePath = (url: string, base: string): string => {
  const basePath = removeTailingSlash(base);
  if (basePath === '' || !url.startsWith(basePath)) {
    return url;
  }

  const nextChar = url[basePath.length];

  if (nextChar === undefined) {
    return '/';
  }

  if (nextChar === '/') {
    return url.slice(basePath.length);
  }

  if (nextChar === '?' || nextChar === '#') {
    return `/${url.slice(basePath.length)}`;
  }

  return url;
};

export const getRoutes = (context: InternalContext): Routes => {
  const environmentWithHtml = context.environmentList.filter(
    (item) => Object.keys(item.htmlPaths).length > 0,
  );
  if (environmentWithHtml.length === 0) {
    return [];
  }

  const commonDistPath = getCommonParentPath(environmentWithHtml.map((item) => item.distPath));

  return environmentWithHtml.reduce<Routes>((prev, environmentContext) => {
    const { distPath, config } = environmentContext;
    const distPrefix = relative(commonDistPath, distPath).split(sep).join('/');

    const routes = formatRoutes(
      environmentContext.htmlPaths,
      context.normalizedConfig!.server.base,
      posix.join(distPrefix, config.output.distPath.html),
      config.html.outputStructure,
    );
    return prev.concat(...routes);
  }, []);
};

/*
 * format route by entry and adjust the index route to be the first
 */
export const formatRoutes = (
  entry: RsbuildEntry,
  base: string,
  distPathPrefix: string | undefined,
  outputStructure: OutputStructure | undefined,
): Routes => {
  const prefix = joinUrlPath(base, formatPrefix(distPathPrefix));

  return (
    Object.keys(entry)
      .map((entryName) => {
        // fix case: /html/index/index.html
        const isIndex = entryName === 'index' && outputStructure !== 'nested';
        const displayName = isIndex ? '' : entryName;
        return {
          entryName,
          pathname: prefix + displayName,
        };
      })
      // adjust the index route to be the first
      .sort((a) => (a.entryName === 'index' ? -1 : 1))
  );
};

function getURLMessages(
  urls: { url: string; label: string }[],
  routes: Routes,
  {
    maxRoutes = DEFAULT_MAX_ROUTES,
    showAllRoutes,
    cliShortcutsEnabled,
  }: {
    maxRoutes?: number;
    showAllRoutes?: boolean;
    cliShortcutsEnabled: boolean;
  },
) {
  const routeLimit = showAllRoutes ? Number.POSITIVE_INFINITY : normalizeMaxRoutes(maxRoutes);
  const printableRoutes = routeLimit === 0 ? [] : routes.slice(0, routeLimit);
  const moreEntries = routeLimit > 0 ? routes.length - printableRoutes.length : 0;

  if (routes.length <= 1 || printableRoutes.length === 0) {
    const pathname = printableRoutes.length ? printableRoutes[0].pathname : '';
    const maxTrimmedLength = Math.max(...urls.map((u) => u.label.trimEnd().length));
    const padWidth = Math.max(maxTrimmedLength + 2, 10);
    let message = urls
      .map(({ label, url }) => {
        const normalizedPathname = normalizeUrl(`${url}${pathname}`);
        const prefix = `➜  ${color.dim(label.trimEnd().padEnd(padWidth))}`;
        return `  ${prefix}${color.cyan(normalizedPathname)}\n`;
      })
      .join('');

    if (moreEntries > 0) {
      message += getMoreEntriesMessage(moreEntries, cliShortcutsEnabled);
    }

    return message;
  }

  let message = '';
  let prevLabel = '';
  const maxNameLength = Math.max(...printableRoutes.map((r) => r.entryName.length));
  urls.forEach(({ label, url }, index) => {
    if (prevLabel !== label) {
      if (index > 0) {
        message += '\n';
      }
      message += `  ➜  ${label}\n`;
      prevLabel = label;
    }

    for (const { entryName, pathname } of printableRoutes) {
      message += `  ${color.dim('-')}  ${color.dim(
        entryName.padEnd(maxNameLength + 4),
      )}${color.cyan(normalizeUrl(`${url}${pathname}`))}\n`;
    }
  });

  if (moreEntries > 0) {
    message += getMoreEntriesMessage(moreEntries, cliShortcutsEnabled);
  }

  return message;
}

export function printServerURLs({
  urls: originalUrls,
  port,
  routes,
  protocol,
  printUrls,
  fallbackPathname,
  showAllRoutes,
  cliShortcutsEnabled,
  originalConfig,
  logger,
}: {
  urls: { url: string; label: string }[];
  port: number;
  routes: Routes;
  protocol: string;
  printUrls?: PrintUrls;
  fallbackPathname?: string;
  showAllRoutes?: boolean;
  cliShortcutsEnabled: boolean;
  originalConfig?: Readonly<RsbuildConfig>;
  logger: Logger;
}): string | null {
  if (printUrls === false) {
    return null;
  }

  let urls = originalUrls;
  const useCustomUrl = isFunction(printUrls);

  if (useCustomUrl) {
    const newUrls = printUrls({
      urls: urls.map((item) => item.url),
      port,
      routes,
      protocol,
    });

    if (!newUrls) {
      return null;
    }

    if (!Array.isArray(newUrls)) {
      throw new Error(
        `${color.dim('[rsbuild:config]')} "server.printUrls" must return an array, but got ${typeof newUrls}.`,
      );
    }

    urls = newUrls.map((u) => {
      const { url, label } = typeof u === 'string' ? { url: u } : u;
      return { url, label: label ?? getUrlLabel(url) };
    });
  }

  // If no urls, skip printing
  if (urls.length === 0) {
    return null;
  }

  // When there are no HTML routes, print the server base URL as the default
  // access path.
  const printableRoutes =
    routes.length === 0 && !useCustomUrl && fallbackPathname !== undefined
      ? [{ entryName: 'index', pathname: formatPrefix(fallbackPathname) }]
      : routes;

  // If no routes and not use custom url, skip printing
  if (printableRoutes.length === 0 && !useCustomUrl) {
    return null;
  }

  const printUrlsOptions = getPrintUrlsOptions(printUrls);
  let message = getURLMessages(urls, printableRoutes, {
    maxRoutes: useCustomUrl ? Number.POSITIVE_INFINITY : printUrlsOptions.maxRoutes,
    showAllRoutes,
    cliShortcutsEnabled,
  });

  if (originalConfig && originalConfig.server?.host === undefined) {
    message += `  ➜  ${color.dim('Network:')}  ${color.dim('use')} ${color.bold('--host')} ${color.dim('to expose')}\n`;
  }

  if (cliShortcutsEnabled === true && message.endsWith('\n')) {
    message = message.slice(0, -1);
  }

  logger.log(message);

  return message;
}

/**
 * Get available free port.
 * @param port - Current port want to use.
 * @param tryLimits - Maximum number of retries.
 * @param strictPort - Whether to throw an error when the port is occupied.
 * @returns Available port number.
 */
export const getPort = async ({
  host,
  port,
  strictPort,
  tryLimits = 20,
}: {
  host: string;
  port: string | number;
  strictPort: boolean;
  tryLimits?: number;
}): Promise<number> => {
  if (typeof port === 'string') {
    port = Number.parseInt(port, 10);
  }

  if (strictPort) {
    tryLimits = 1;
  }

  const { createServer } = await import('node:net');
  const original = port;

  let found = false;
  let attempts = 0;

  while (!found && attempts <= tryLimits) {
    try {
      await new Promise((resolve, reject) => {
        const server = createServer();
        server.unref();
        server.on('error', reject);
        server.listen({ port, host }, () => {
          found = true;
          server.close(resolve);
        });
      });
    } catch (e: any) {
      if (e.code !== 'EADDRINUSE') {
        throw e;
      }
      port++;
      attempts++;
    }
  }

  if (!found) {
    throw new Error(
      `${color.dim('[rsbuild:server]')} Failed to find an available port after ${
        tryLimits + 1
      } attempts, starting from ${color.yellow(original)}.`,
    );
  }

  if (port !== original) {
    if (strictPort) {
      throw new Error(
        `${color.dim('[rsbuild:server]')} Port ${color.yellow(
          original,
        )} is occupied, please choose another one.`,
      );
    }
  }

  return port;
};

export const resolvePort = async (
  config: NormalizedConfig,
): Promise<{
  port: number;
  portTip: string | undefined;
}> => {
  const { host, port: originalPort, strictPort } = config.server;
  const port = await getPort({
    host,
    port: originalPort,
    strictPort,
  });
  const portTip =
    port !== originalPort
      ? `port ${originalPort} is in use, ${color.yellow(`using port ${port}.`)}`
      : undefined;
  return {
    port,
    portTip,
  };
};

const getIpv4Interfaces = () => {
  const interfaces = os.networkInterfaces();
  const ipv4Interfaces = new Map<string, os.NetworkInterfaceInfo>();

  for (const key of Object.keys(interfaces)) {
    for (const detail of interfaces[key]!) {
      // 'IPv4' is in Node <= 17, from 18 it's a number 4 or 6
      const familyV4Value = typeof detail.family === 'string' ? 'IPv4' : 4;

      if (detail.family === familyV4Value && !ipv4Interfaces.has(detail.address)) {
        ipv4Interfaces.set(detail.address, detail);
      }
    }
  }

  return Array.from(ipv4Interfaces.values());
};

export const isWildcardHost = (host: string): boolean => {
  const wildcardHosts = new Set([
    ALL_INTERFACES_IPV4,
    '::',
    '0000:0000:0000:0000:0000:0000:0000:0000',
  ]);
  return wildcardHosts.has(host);
};

const isLoopbackHost = (host: string) => {
  const loopbackHosts = new Set([
    LOCALHOST,
    '127.0.0.1',
    '::1',
    '0000:0000:0000:0000:0000:0000:0000:0001',
  ]);
  return loopbackHosts.has(host);
};

export const getHostInUrl = async (host: string): Promise<string> => {
  if (host === ALL_INTERFACES_IPV4 || host === LOCALHOST) {
    return LOCALHOST;
  }

  const { isIPv6 } = await import('node:net');
  if (isIPv6(host)) {
    return host === '::' ? '[::1]' : `[${host}]`;
  }
  return host;
};

const concatUrl = ({ host, port, protocol }: { host: string; port: number; protocol: string }) =>
  `${protocol}://${host}:${port}`;

const LOCAL_LABEL = 'Local:  ';
const NETWORK_LABEL = 'Network:  ';

const getUrlLabel = (url: string) => {
  try {
    const { hostname } = new URL(url);
    return isLoopbackHost(hostname) ? LOCAL_LABEL : NETWORK_LABEL;
  } catch {
    return NETWORK_LABEL;
  }
};

type AddressUrl = { label: string; url: string };

export const getAddressUrls = async ({
  protocol,
  port,
  host,
}: {
  protocol: string;
  port: number;
  host?: string;
}): Promise<AddressUrl[]> => {
  if (host && host !== ALL_INTERFACES_IPV4) {
    const url = concatUrl({
      port,
      host: await getHostInUrl(host),
      protocol,
    });
    return [
      {
        label: isLoopbackHost(host) ? LOCAL_LABEL : NETWORK_LABEL,
        url,
      },
    ];
  }

  const ipv4Interfaces = getIpv4Interfaces();
  const addressUrls: AddressUrl[] = [];
  let hasLocalUrl = false;

  for (const detail of ipv4Interfaces) {
    if (isLoopbackHost(detail.address) || detail.internal) {
      // avoid multiple prints of localhost
      // https://github.com/web-infra-dev/rsbuild/discussions/1543
      if (hasLocalUrl) {
        continue;
      }

      addressUrls.push({
        label: LOCAL_LABEL,
        url: concatUrl({ host: LOCALHOST, port, protocol }),
      });
      hasLocalUrl = true;
    } else {
      addressUrls.push({
        label: NETWORK_LABEL,
        url: concatUrl({ host: detail.address, port, protocol }),
      });
    }
  }

  return addressUrls;
};

export function getServerTerminator(server: Server | Http2SecureServer): () => Promise<void> {
  let listened = false;
  const pendingSockets = new Set<Socket>();

  const onConnection = (socket: Socket) => {
    pendingSockets.add(socket);
    socket.on('close', () => {
      pendingSockets.delete(socket);
    });
  };

  server.on('connection', onConnection);
  server.on('secureConnection', onConnection);
  server.once('listening', () => {
    listened = true;
  });

  return () =>
    new Promise<void>((resolve, reject) => {
      for (const socket of pendingSockets) {
        socket.destroy();
      }
      if (listened) {
        server.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
}

/**
 * Escape HTML characters
 * @example
 * escapeHtml('<div>Hello</div>') // '&lt;div&gt;Hello&lt;/div&gt;'
 */
export function escapeHtml(text: string | null | undefined): string {
  if (!text) {
    return '';
  }
  // `&` must be replaced first to avoid double-escaping
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const HttpCode = {
  Ok: 200,
  NotModified: 304,
  BadRequest: 400,
  Forbidden: 403,
  NotFound: 404,
  PreconditionFailed: 412,
  RangeNotSatisfiable: 416,
  InternalServerError: 500,
} as const;

/**
 * The public server API shared by both the dev and preview servers.
 */
export type RsbuildServerBase = {
  /**
   * Close the server.
   * In the dev server, this will call the `onCloseDevServer` hook.
   */
  close: () => Promise<void>;
  /**
   * The Node.js HTTP server instance.
   * - Will be `Http2SecureServer` if `server.https` config is used.
   * - Will be `null` if `server.middlewareMode` is enabled.
   */
  httpServer: import('node:http').Server | import('node:http2').Http2SecureServer | null;
  /**
   * The `connect` app instance.
   * Can be used to attach custom middlewares to the server.
   */
  middlewares: Connect.Server;
  /**
   * Open URL in the browser after starting the server.
   */
  open: () => Promise<void>;
  /**
   * The resolved port.
   * By default, Rsbuild server listens on port `3000` and automatically increments
   * the port number if the port is occupied.
   */
  port: number;
  /**
   * Print the server URLs.
   */
  printUrls: () => void;
};
