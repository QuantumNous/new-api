import path from 'node:path';
import { pathToFileURL } from 'node:url';
import resolveUrlHelpers from '../compiled/resolve-url-loader/index.js';

const GLOBAL_PATCHED_SYMBOL: unique symbol = Symbol('GLOBAL_PATCHED_SYMBOL');

declare global {
  interface Location {
    [GLOBAL_PATCHED_SYMBOL]?: true;
  }
}

/** fix issue about dart2js: https://github.com/dart-lang/sdk/issues/27979 */
function patchGlobalLocation() {
  if (!global.location) {
    const href = pathToFileURL(process.cwd()).href + path.sep;
    const location = Object.freeze({ [GLOBAL_PATCHED_SYMBOL]: true, href });
    global.location = location as Location;
  }
}

function unpatchGlobalLocation() {
  if (global.location?.[GLOBAL_PATCHED_SYMBOL]) {
    delete (global as { location?: Location }).location;
  }
}

type CompilerTapFn<CallBack extends (...args: unknown[]) => void = () => void> = {
  tap: (name: string, cb: CallBack) => void;
};

export function patchCompilerGlobalLocation(compiler: {
  hooks: {
    run: CompilerTapFn;
    watchRun: CompilerTapFn;
    watchClose: CompilerTapFn;
    done: CompilerTapFn;
  };
}): void {
  // https://github.com/webpack/webpack/blob/136b723023f8f26d71eabdd16badf04c1c8554e4/lib/MultiCompiler.js#L64
  compiler.hooks.run.tap('PatchGlobalLocation', patchGlobalLocation);
  compiler.hooks.watchRun.tap('PatchGlobalLocation', patchGlobalLocation);
  compiler.hooks.watchClose.tap('PatchGlobalLocation', unpatchGlobalLocation);
  compiler.hooks.done.tap('PatchGlobalLocation', unpatchGlobalLocation);
}

type ResolveUrlJoinItem = {
  uri: string;
  [key: string]: unknown;
};

/**
 * fix resolve-url-loader can't deal with resolve.alias config
 *
 * reference: https://github.com/bholloway/resolve-url-loader/blob/e2695cde68f325f617825e168173df92236efb93/packages/resolve-url-loader/docs/advanced-features.md
 */
export const getResolveUrlJoinFn = (): ((...args: unknown[]) => void) => {
  const { createJoinFunction, asGenerator, createJoinImplementation, defaultJoinGenerator } =
    resolveUrlHelpers;

  const rsbuildGenerator = asGenerator((item: ResolveUrlJoinItem, ...rest: unknown[]) => {
    // only handle relative path (not absolutely accurate, but can meet common scenarios)
    if (!item.uri.startsWith('.')) {
      return [null];
    }
    return defaultJoinGenerator(item, ...rest);
  });
  return createJoinFunction('rsbuild-resolve-join-fn', createJoinImplementation(rsbuildGenerator));
};
