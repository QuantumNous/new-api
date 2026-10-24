import { getPathnameFromUrl } from '../helpers/path';
import { removeBasePath } from './helper';

export const getPublicPathname = (publicPath: string): string => {
  if (publicPath === 'auto' || publicPath === '') {
    return '';
  }

  return getPathnameFromUrl(publicPath.endsWith('/') ? publicPath : `${publicPath}/`);
};

export const getPublicPathnames = (publicPaths: string[], base: string): string[] => {
  return publicPaths
    .map(getPublicPathname)
    .map((prefix) => (base && base !== '/' ? removeBasePath(prefix, base) : prefix));
};
