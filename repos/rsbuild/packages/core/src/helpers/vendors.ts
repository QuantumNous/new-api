import { createRequire } from 'node:module';
import { COMPILED_PATH } from '../constants';

type CompiledPackages = {
  'html-rspack-plugin': typeof import('../../compiled/html-rspack-plugin').default;
};

export const require: NodeJS.Require = createRequire(import.meta.url);

/**
 * Load compiled package from `compiled` folder.
 * use `require()` as compiled packages are CommonJS modules.
 * https://github.com/nodejs/node/issues/59913
 * @param name
 * @returns
 */
export const requireCompiledPackage = <T extends keyof CompiledPackages>(
  name: T,
): CompiledPackages[T] => require(`${COMPILED_PATH}/${name}/index.js`);
