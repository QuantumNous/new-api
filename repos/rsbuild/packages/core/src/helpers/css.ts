import type { LoaderContext, NormalModule } from '@rspack/core';
import type { CSSLoaderOptions } from '../types';

const CSS_MODULE_REGEX = /\.module(s)?\.\w+$/i;
const CSS_ICSS_REGEX = /\.icss\.\w+$/i;

export const isCSSModules = (
  modules: CSSLoaderOptions['modules'],
  loaderContext: LoaderContext,
): boolean => {
  if (!modules) {
    return false;
  }

  if (modules === true || typeof modules === 'string') {
    return true;
  }

  const { auto } = modules;

  // Align with css-loader: object-form `modules` without `auto` enables CSS Modules for all files.
  if (auto === undefined) {
    return true;
  }

  if (auto === false) {
    return false;
  }

  // Only resolve the css-loader-compatible path for `auto` checks that need it.
  // Align with css-loader: CSS Modules auto detection uses matchResource when present.
  const resourcePath =
    (loaderContext._module as NormalModule | undefined)?.matchResource ||
    loaderContext.resourcePath;

  if (auto instanceof RegExp) {
    return auto.test(resourcePath);
  }

  if (typeof auto === 'function') {
    return auto(resourcePath, loaderContext.resourceQuery, loaderContext.resourceFragment);
  }

  return CSS_MODULE_REGEX.test(resourcePath) || CSS_ICSS_REGEX.test(resourcePath);
};
