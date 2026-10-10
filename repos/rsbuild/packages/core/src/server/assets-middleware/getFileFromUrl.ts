import type { Stats as FSStats } from 'node:fs';
import path from 'node:path';
import { getPathnameFromUrl } from '../../helpers/path';
import type { InternalContext, Rspack } from '../../types';
import { HttpCode, isUrlPathUnderBase } from '../helper';

const UP_PATH_REGEXP = /(?:^|[\\/])\.\.(?:[\\/]|$)/;

/**
 * Resolves URL to file path with security checks and retrieves file from
 * the build output directories.
 */
export async function getFileFromUrl(
  url: string,
  outputFileSystem: Rspack.OutputFileSystem,
  context: InternalContext,
): Promise<{ filename: string; fsStats: FSStats } | { errorCode: number } | undefined> {
  let pathname = getPathnameFromUrl(url);

  try {
    pathname = decodeURIComponent(pathname);
  } catch {
    return { errorCode: HttpCode.BadRequest };
  }

  if (!pathname) {
    return;
  }

  // Return early to prevent null byte injection attacks
  if (pathname.includes('\0')) {
    return { errorCode: HttpCode.BadRequest };
  }

  // Prevent path traversal attacks by checking for ".." patterns
  if (UP_PATH_REGEXP.test(path.normalize(`./${pathname}`))) {
    return { errorCode: HttpCode.Forbidden };
  }

  const stat = async (filename: string) => {
    return new Promise<FSStats | undefined>((resolve, reject) => {
      outputFileSystem.stat(filename, (err, stats) => {
        if (err) {
          reject(err);
        } else {
          resolve(stats);
        }
      });
    });
  };

  const { environmentList, publicPathnames } = context;
  const distPaths = environmentList.map((env) => env.distPath);
  const possibleFilenames = new Set<string>();

  // First, add paths that match the public prefix for more accurate resolution
  for (const [index, distPath] of distPaths.entries()) {
    const prefix = publicPathnames[index];
    if (prefix && prefix !== '/' && isUrlPathUnderBase(pathname, prefix)) {
      // Strip the `pathname` property from the `publicPath` option from the start
      // of requested url. (`/prefix/foo.js` => `foo.js`)
      // And add outputPath (`foo.js` => `/home/user/my-project/dist/foo.js`)
      possibleFilenames.add(path.join(distPath, pathname.slice(prefix.length)));
    }
  }

  // Then, add fallback paths without prefix matching
  for (const distPath of distPaths) {
    possibleFilenames.add(path.join(distPath, pathname));
  }

  for (let filename of possibleFilenames) {
    let fsStats: FSStats | undefined;

    try {
      fsStats = await stat(filename);
    } catch {
      continue;
    }

    if (!fsStats) {
      continue;
    }

    if (fsStats.isFile()) {
      return { filename, fsStats };
    }

    if (fsStats.isDirectory()) {
      filename = path.join(filename, 'index.html');

      try {
        fsStats = await stat(filename);
      } catch {
        continue;
      }

      if (!fsStats) {
        continue;
      }

      if (fsStats.isFile()) {
        return { filename, fsStats };
      }
    }
  }
}
