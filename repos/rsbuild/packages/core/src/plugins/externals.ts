import { resolve } from 'node:path';
import type { Externals } from '@rspack/core';
import { castArray, isPlainObject } from '../helpers';
import { readPackageJsonByPath, type PackageJson } from '../helpers/packageJson';
import type { AutoExternal, RsbuildPlugin } from '../types';

type DependencyType =
  | 'dependencies'
  | 'optionalDependencies'
  | 'peerDependencies'
  | 'devDependencies';

const dependencyTypes: DependencyType[] = [
  'dependencies',
  'peerDependencies',
  'devDependencies',
  'optionalDependencies',
];

const defaultAutoExternalOptions = {
  dependencies: true,
  optionalDependencies: true,
  peerDependencies: true,
  devDependencies: false,
};

const resolveAutoExternalOptions = (autoExternal?: AutoExternal) => {
  if (autoExternal === undefined || autoExternal === false) {
    return undefined;
  }

  const externalOptions = {
    ...defaultAutoExternalOptions,
    ...(autoExternal === true ? {} : autoExternal),
  };

  return dependencyTypes.some((type) => externalOptions[type]) ? externalOptions : undefined;
};

const escapeRegExp = (str: string): string => str.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');

const resolvePackageJsonPaths = (rootPath: string, packageJson?: string | string[]): string[] => {
  return castArray(packageJson ?? 'package.json').map((path) => resolve(rootPath, path));
};

const mergePackageJsonList = (packageJsonList: PackageJson[]): PackageJson | undefined => {
  if (!packageJsonList.length) {
    return undefined;
  }

  return dependencyTypes.reduce<PackageJson>((merged, type) => {
    for (const pkgJson of packageJsonList) {
      const deps = pkgJson[type];

      if (isPlainObject(deps)) {
        merged[type] = {
          ...merged[type],
          ...deps,
        };
      }
    }

    return merged;
  }, {});
};

const readPackageJsonList = async (
  paths: string[],
  cache: Map<string, PackageJson | undefined>,
): Promise<PackageJson | undefined> => {
  const packageJsonList = await Promise.all(
    paths.map(async (path) => {
      if (!cache.has(path)) {
        cache.set(path, await readPackageJsonByPath(path));
      }

      return cache.get(path);
    }),
  );

  return mergePackageJsonList(
    packageJsonList.filter((pkgJson): pkgJson is PackageJson => Boolean(pkgJson)),
  );
};

const matchAutoExternalExclude = (packageName: string, conditions: unknown[]): boolean => {
  return conditions.some((condition) => {
    if (typeof condition === 'string') {
      return condition === packageName;
    }

    if (condition instanceof RegExp) {
      // Clone stateful regexps to avoid mutating user config via `lastIndex`.
      const regexp = condition.global || condition.sticky ? new RegExp(condition) : condition;
      return regexp.test(packageName);
    }

    return false;
  });
};

export const composeAutoExternalRules = (options: {
  autoExternal?: AutoExternal;
  pkgJson?: PackageJson;
  userExternals?: Externals;
}): RegExp[] | undefined => {
  const { autoExternal, pkgJson, userExternals } = options;
  const externalOptions = resolveAutoExternalOptions(autoExternal);

  if (!externalOptions || !pkgJson) {
    return undefined;
  }

  // User externals configuration has higher priority than autoExternal.
  // Only object externals can be safely deduplicated by request name.
  const userExternalKeys = isPlainObject(userExternals) ? Object.keys(userExternals) : [];
  const excludeConditions = externalOptions.exclude
    ? castArray(externalOptions.exclude)
    : undefined;

  const externals = dependencyTypes
    .reduce<string[]>((prev, type) => {
      if (externalOptions[type]) {
        const deps = pkgJson[type];
        return isPlainObject(deps) ? prev.concat(Object.keys(deps)) : prev;
      }
      return prev;
    }, [])
    .filter(
      (name) =>
        !userExternalKeys.includes(name) &&
        (!excludeConditions || !matchAutoExternalExclude(name, excludeConditions)),
    );

  const uniqueExternals = Array.from(new Set(externals));

  if (!uniqueExternals.length) {
    return undefined;
  }

  // Exclude dependencies and subpath imports, e.g. `react`, `react/jsx-runtime`.
  return uniqueExternals.map((dep) => new RegExp(`^${escapeRegExp(dep)}(?:$|[/\\\\])`));
};

const mergeExternals = (
  userExternals: Externals | undefined,
  autoExternalRules: RegExp[] | undefined,
): Externals | undefined => {
  if (!autoExternalRules?.length) {
    return userExternals;
  }

  if (!userExternals) {
    return autoExternalRules;
  }

  return Array.isArray(userExternals)
    ? [...userExternals, ...autoExternalRules]
    : [userExternals, ...autoExternalRules];
};

export function pluginExternals(): RsbuildPlugin {
  return {
    name: 'rsbuild:externals',
    setup(api) {
      const packageJsonCache = new Map<string, PackageJson | undefined>();
      let hasWarnedReadPackageJsonFailed = false;

      api.modifyBundlerChain(async (chain, { environment }) => {
        const { autoExternal, externals } = environment.config.output;
        const externalOptions = resolveAutoExternalOptions(autoExternal);
        let pkgJson: PackageJson | undefined;

        if (externalOptions) {
          const packageJsonPaths = resolvePackageJsonPaths(
            api.context.rootPath,
            externalOptions.packageJson,
          );
          pkgJson = await readPackageJsonList(packageJsonPaths, packageJsonCache);
        }

        if (externalOptions && !pkgJson && !hasWarnedReadPackageJsonFailed) {
          api.logger.warn(
            'The `output.autoExternal` configuration will not be applied because reading package.json failed.',
          );
          hasWarnedReadPackageJsonFailed = true;
        }

        const autoExternalRules = composeAutoExternalRules({
          autoExternal,
          pkgJson,
          userExternals: externals,
        });

        const mergedExternals = mergeExternals(externals, autoExternalRules);

        if (mergedExternals) {
          chain.externals(mergedExternals);
        }
      });

      api.onBeforeCreateCompiler(({ bundlerConfigs }) => {
        for (const config of bundlerConfigs) {
          const isWebWorker = Array.isArray(config.target)
            ? config.target.includes('webworker')
            : config.target === 'webworker';

          // externals will not take effect, the Worker environment can not access global variables.
          if (isWebWorker && config.externals) {
            delete config.externals;
          }
        }
      });
    },
  };
}
