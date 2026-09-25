import path from 'node:path';
import { require } from '../../helpers';
import { BasicRunner } from './basic';
import type {
  BasicGlobalContext,
  BasicModuleScope,
  BasicRunnerFile,
  ModuleObject,
  RunnerRequirer,
} from './type';

const define = (...args: unknown[]) => {
  const factory = args.pop() as () => void;
  factory();
};

export class CommonJsRunner extends BasicRunner {
  protected createGlobalContext(): BasicGlobalContext {
    return {
      console: console,
      setTimeout: ((...args: Parameters<typeof setTimeout>) => {
        const timeout = setTimeout(...args);
        timeout.unref();
        return timeout;
      }) as typeof setTimeout,
      clearTimeout: clearTimeout,
      queueMicrotask,
    };
  }

  protected createBaseModuleScope(): BasicModuleScope {
    const baseModuleScope: BasicModuleScope = {
      console: this.globalContext!.console,
      setTimeout: this.globalContext!.setTimeout,
      clearTimeout: this.globalContext!.clearTimeout,
      nsObj: (m: Record<string, unknown>) => {
        Object.defineProperty(m, Symbol.toStringTag, {
          value: 'Module',
        });
        return m;
      },
      queueMicrotask,
    };
    return baseModuleScope;
  }

  protected createModuleScope(
    requireFn: RunnerRequirer,
    m: ModuleObject,
    file: BasicRunnerFile,
  ): BasicModuleScope {
    return {
      ...this.baseModuleScope!,
      require: requireFn.bind(null, path.dirname(file.path)),
      module: m,
      exports: m.exports,
      __dirname: path.dirname(file.path),
      __filename: file.path,
      define,
    };
  }

  protected createRunner(): void {
    this.requirers.set('miss', this.createMissRequirer());
    this.requirers.set('entry', this.createCjsRequirer());
  }

  protected createMissRequirer(): RunnerRequirer {
    return (_currentDirectory, modulePath, _context = {}) => {
      const modulePathStr = modulePath as string;
      const resolvedPath = require.resolve(modulePathStr, {
        paths: [_currentDirectory],
      });

      // rslint-disable-next-line @typescript-eslint/no-require-imports
      return require(resolvedPath.startsWith('node:') ? resolvedPath.slice(5) : resolvedPath);
    };
  }

  protected createCjsRequirer(): RunnerRequirer {
    const requireCache: Record<string, ModuleObject> = Object.create(null);
    // rslint-disable-next-line @typescript-eslint/no-require-imports
    const vm = require('node:vm') as typeof import('node:vm');

    return (currentDirectory, modulePath, context = {}) => {
      const file = context.file || this.getFile(modulePath, currentDirectory);
      if (!file) {
        return this.requirers.get('miss')!(currentDirectory, modulePath);
      }

      if (file.path in requireCache) {
        return requireCache[file.path].exports;
      }

      const m = {
        exports: {},
      };
      requireCache[file.path] = m;
      const currentModuleScope = this.createModuleScope(this.getRequire(), m, file);

      const args = Object.keys(currentModuleScope);
      const argValues = args.map((arg) => currentModuleScope[arg]);
      this.preExecute(file.content, file);
      const dynamicImport = new Function('specifier', 'return import(specifier)');
      const fn = vm.compileFunction(file.content, args, {
        filename: file.path,
        // Specify how the modules should be loaded during the evaluation of this script when `import()` is called.
        importModuleDynamically: async (specifier) => {
          const result = await dynamicImport(specifier);
          return result;
        },
      });

      fn.call(m.exports, ...argValues);

      this.postExecute(m, file);
      return m.exports;
    };
  }
}
