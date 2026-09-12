import { rspack } from '@rspack/core';
import { DEFAULT_ASSET_PREFIX } from '../constants';
import type { Rspack } from '../types';

export const isMultiCompiler = (
  compiler: Rspack.Compiler | Rspack.MultiCompiler,
): compiler is Rspack.MultiCompiler => {
  return 'compilers' in compiler && Array.isArray(compiler.compilers);
};

export const getPublicPathFromCompiler = (
  compiler: Rspack.Compiler | Rspack.Compilation,
): string => {
  const { publicPath } = compiler.options.output;

  if (typeof publicPath === 'string') {
    // 'auto' is a magic value in Rspack and behave like `publicPath: ""`
    // Empty string is a valid value representing a relative path and should be preserved
    // This is important for server targets (node) to enable relative paths for worker_threads
    // See: https://github.com/web-infra-dev/rsbuild/issues/6539
    if (publicPath === 'auto' || publicPath === '') {
      return '';
    }
    return publicPath.endsWith('/') ? publicPath : `${publicPath}/`;
  }

  // publicPath function is not supported yet, fallback to default value
  return DEFAULT_ASSET_PREFIX;
};

export const applyToCompiler = (
  compiler: Rspack.Compiler | Rspack.MultiCompiler,
  apply: (c: Rspack.Compiler, index: number) => void,
): void => {
  if (isMultiCompiler(compiler)) {
    compiler.compilers.forEach(apply);
  } else {
    apply(compiler, 0);
  }
};

export const addCompilationError = (compilation: Rspack.Compilation, message: string): void => {
  compilation.errors.push(new rspack.WebpackError(message));
};
