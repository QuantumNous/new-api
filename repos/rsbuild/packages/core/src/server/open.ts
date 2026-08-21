import { URL } from 'node:url';
import { STATIC_PATH } from '../constants';
import { castArray, color } from '../helpers';
import type { Logger } from '../logger';
import type { NormalizedConfig, Routes } from '../types';
import { getHostInUrl } from './helper';

/**
 * browsers on darwin that are supported by `openChrome.applescript`
 */
const supportedChromiumBrowsers = [
  'Google Chrome Canary',
  'Google Chrome Dev',
  'Google Chrome Beta',
  'Google Chrome',
  'Microsoft Edge',
  'Brave Browser',
  'Vivaldi',
  'Chromium',
  'Helium',
];

/**
 * Map the browser name to the name used in `openChrome.applescript`
 */
const mapChromiumBrowserName = (browser: string) => {
  if (browser === 'chrome' || browser === 'google chrome') {
    return 'Google Chrome';
  }
  return browser;
};

/**
 * Determine if we should try to open the browser with `openChrome.applescript`
 */
const shouldTryAppleScript = (browser?: string, browserArgs?: string) => {
  if (process.platform !== 'darwin') {
    return false;
  }
  // AppleScript does not support passing arguments
  // fallback to `open` library
  if (browser && browserArgs) {
    return false;
  }
  if (!browser) {
    return true;
  }
  return supportedChromiumBrowsers.includes(mapChromiumBrowserName(browser));
};

/**
 * This method is modified based on source found in
 * https://github.com/facebook/create-react-app
 *
 * MIT Licensed
 * Copyright (c) 2015-present, Facebook, Inc.
 * https://github.com/facebook/create-react-app/blob/master/LICENSE
 */
async function openBrowser(url: string, logger: Logger): Promise<boolean> {
  const browser = process.env.BROWSER;
  const browserArgs = process.env.BROWSER_ARGS;

  // If we're on OS X, the user hasn't specifically
  // requested a different browser, we can try opening
  // a Chromium browser with AppleScript. This lets us reuse an
  // existing tab when possible instead of creating a new one.
  if (shouldTryAppleScript(browser, browserArgs)) {
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execFileAsync = promisify(execFile);

    /**
     * Find the browser that is currently running
     */
    const getDefaultBrowserForAppleScript = async () => {
      const { stdout: ps } = await execFileAsync('ps', ['cax']);
      return supportedChromiumBrowsers.find((b) => ps.includes(b));
    };

    try {
      const chromiumBrowser = browser
        ? mapChromiumBrowserName(browser)
        : await getDefaultBrowserForAppleScript();

      if (chromiumBrowser) {
        // Try to reuse existing tab with AppleScript
        await execFileAsync(
          'osascript',
          ['openChrome.applescript', encodeURI(url), chromiumBrowser],
          {
            cwd: STATIC_PATH,
          },
        );
        return true;
      }
      logger.debug('failed to find the target browser.');
    } catch (err) {
      logger.debug('failed to open start URL with apple script.');
      logger.debug(err);
    }
  }

  const { apps, default: baseOpen } = await import(
    /* rspackChunkName: "open" */
    'open'
  );

  // Fallback to open
  // It will always open new tab
  try {
    const options = browser
      ? {
          app: {
            name: apps[browser as keyof typeof apps] ?? browser,
            arguments: browserArgs?.split(' '),
          },
        }
      : {};

    const childProcess = await baseOpen(url, options);
    childProcess.on('error', (err) => {
      logger.error('Failed to launch browser in child process', err);
    });

    return true;
  } catch (err) {
    logger.error('Failed to launch browser.');
    logger.error(err);
    return false;
  }
}

let openedURLs: string[] = [];

const clearOpenedURLs = () => {
  openedURLs = [];
};

export const replacePortPlaceholder = (url: string, port: number): string =>
  url.replace(/<port>/g, String(port));

export function resolveUrl(str: string, base: string): string {
  if (URL.canParse(str)) {
    return str;
  }

  try {
    const url = new URL(str, base);
    return url.href;
  } catch {
    throw new Error(
      `${color.dim('[rsbuild:open]')} Invalid input: ${color.yellow(
        str,
      )} is not a valid URL or pathname`,
    );
  }
}

const normalizeOpenConfig = (
  config: NormalizedConfig,
): { targets: string[]; before?: () => Promise<void> | void } => {
  const { open } = config.server;

  if (typeof open === 'boolean') {
    return { targets: [] };
  }
  if (typeof open === 'string') {
    return { targets: [open] };
  }
  if (Array.isArray(open)) {
    return { targets: open };
  }

  return {
    targets: open.target ? castArray(open.target) : [],
    before: open.before,
  };
};

export async function open({
  port,
  routes,
  config,
  protocol,
  clearCache,
  logger,
}: {
  port: number;
  routes: Routes;
  config: NormalizedConfig;
  protocol: string;
  clearCache?: boolean;
  logger: Logger;
}): Promise<void> {
  // Skip auto-opening browser in CodeSandbox since it's already
  // a web-based environment.
  const isCodesandbox = process.env.CSB === 'true';
  if (isCodesandbox) {
    return;
  }

  const { targets, before } = normalizeOpenConfig(config);

  if (clearCache) {
    clearOpenedURLs();
  }

  const urls: string[] = [];
  const host = await getHostInUrl(config.server.host);
  const baseUrl = `${protocol}://${host}:${port}`;

  if (!targets.length) {
    if (routes.length) {
      // auto open the first one
      urls.push(`${baseUrl}${routes[0].pathname}`);
    } else {
      urls.push(baseUrl);
    }
  } else {
    urls.push(
      ...targets.map((target) => resolveUrl(replacePortPlaceholder(target, port), baseUrl)),
    );
  }

  if (before) {
    await before();
  }

  for (const url of urls) {
    /**
     * If an URL has been opened in current process, we will not open it again.
     * It can prevent opening the same URL multiple times.
     */
    if (!openedURLs.includes(url)) {
      openBrowser(url, logger);
      openedURLs.push(url);
    }
  }
}
