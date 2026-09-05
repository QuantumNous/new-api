import type { LoaderDefinition, PitchLoaderDefinitionFunction } from '@rspack/core';
import { isCSSModules } from '../helpers/css';
import type { CSSLoaderOptions } from '../types';

type IgnoreCssLoaderOptions = {
  modules?: CSSLoaderOptions['modules'];
};

const ignoreCssLoader: LoaderDefinition<IgnoreCssLoaderOptions> = function (source) {
  // if the source code include '___CSS_LOADER_EXPORT___'
  // It is not a CSS Modules file because exportOnlyLocals is enabled,
  // so we don't need to preserve it.
  if (source.includes('___CSS_LOADER_EXPORT___')) {
    return '';
  }

  // Preserve CSS Modules export for SSR.
  return source;
};

// In non-emitting builds, skip css-loader and following CSS transforms for global CSS.
// CSS Modules must still pass through css-loader so SSR builds can export locals.
export const pitch: PitchLoaderDefinitionFunction<IgnoreCssLoaderOptions> = function () {
  const { modules } = this.getOptions();

  if (isCSSModules(modules, this)) {
    return;
  }

  return '';
};

export default ignoreCssLoader;
