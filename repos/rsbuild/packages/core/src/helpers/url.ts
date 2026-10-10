import { posix } from 'node:path';
import { URL } from 'node:url';
import type { RspackChain } from 'rspack-chain';
import { DEFAULT_ASSET_PREFIX } from '../constants';
import type { Rspack } from '../types';

export const removeLeadingSlash = (s: string): string => s.replace(/^\/+/, '');
export const removeTailingSlash = (s: string): string =>
  s.endsWith('/') ? s.replace(/\/+$/, '') : s;
export const addTrailingSlash = (s: string): string => (s.endsWith('/') ? s : `${s}/`);

// Determine if the string is a URL
export const isURL = (str: string): boolean => str.startsWith('http') || str.startsWith('//');

export const urlJoin = (base: string, path: string) => {
  const [urlProtocol, baseUrl] = base.split('://');
  return `${urlProtocol}://${posix.join(baseUrl, path)}`;
};

export const ensureAssetPrefix = (
  url: string,
  assetPrefix: Rspack.PublicPath = DEFAULT_ASSET_PREFIX,
): string => {
  // The use of an absolute URL without a protocol is technically legal,
  // however it cannot be parsed as a URL instance, just return it.
  // e.g. str is //example.com/foo.js
  if (url.startsWith('//')) {
    return url;
  }

  // If str is an complete URL, just return it.
  // Only absolute url with hostname & protocol can be parsed into URL instance.
  // e.g. str is https://example.com/foo.js
  if (URL.canParse(url)) {
    return url;
  }

  // 'auto' is a magic value in Rspack and behave like `publicPath: ""`
  if (assetPrefix === 'auto') {
    return url;
  }

  // function is not supported by this helper
  if (typeof assetPrefix === 'function') {
    return url;
  }

  if (assetPrefix.startsWith('http')) {
    return urlJoin(assetPrefix, url);
  }

  if (assetPrefix.startsWith('//')) {
    return urlJoin(`https:${assetPrefix}`, url).replace('https:', '');
  }

  return posix.join(assetPrefix, url);
};

export const formatPublicPath = (publicPath: string, withSlash = true): string => {
  // 'auto' is a magic value in Rspack and we should not add trailing slash
  // Empty string is a valid value representing a relative path and should be preserved (important for node targets)
  if (publicPath === 'auto' || publicPath === '') {
    return publicPath;
  }

  return withSlash ? addTrailingSlash(publicPath) : removeTailingSlash(publicPath);
};

export const getPublicPathFromChain = (chain: RspackChain, withSlash = true): string => {
  const publicPath: Rspack.PublicPath = chain.output.get('publicPath');

  if (typeof publicPath === 'string') {
    return formatPublicPath(publicPath, withSlash);
  }

  return formatPublicPath(DEFAULT_ASSET_PREFIX, withSlash);
};
