import { join, sep } from 'node:path';
import { RSBUILD_OUTPUTS_PATH } from '../constants';
import { color } from '../helpers';
import { emptyDir } from '../helpers/fs';
import type {
  CleanDistPath,
  CleanDistPathObject,
  EnvironmentContext,
  RsbuildPlugin,
} from '../types';

const addTrailingSep = (dir: string) => (dir.endsWith(sep) ? dir : dir + sep);

const isStrictSubdir = (parent: string, child: string) => {
  const parentDir = addTrailingSep(parent);
  const childDir = addTrailingSep(child);
  return parentDir !== childDir && childDir.startsWith(parentDir);
};

const normalizeCleanDistPath = (userOptions: CleanDistPath): CleanDistPathObject => {
  const defaultOptions: CleanDistPathObject = {
    enable: 'auto',
  };

  if (typeof userOptions === 'boolean' || userOptions === 'auto') {
    return {
      ...defaultOptions,
      enable: userOptions,
    };
  }

  return {
    ...defaultOptions,
    ...userOptions,
  };
};

type PathInfo = {
  path: string;
  keep?: RegExp[];
};

export const pluginCleanOutput = (): RsbuildPlugin => ({
  name: 'rsbuild:clean-output',

  setup(api) {
    // clean Rsbuild outputs files, such as the inspected config files
    const getRsbuildOutputPath = (): PathInfo | undefined => {
      const { rootPath, distPath } = api.context;
      const config = api.getNormalizedConfig();
      const targetPath = join(distPath, RSBUILD_OUTPUTS_PATH);
      const { enable } = normalizeCleanDistPath(config.output.cleanDistPath);

      if (enable === true || (enable === 'auto' && isStrictSubdir(rootPath, targetPath))) {
        return {
          path: targetPath,
        };
      }
      return undefined;
    };

    const getPathInfo = (
      environment: EnvironmentContext,
      isDev?: boolean,
    ): PathInfo | undefined => {
      const { rootPath } = api.context;
      const { config, distPath } = environment;
      const { enable, keep } = normalizeCleanDistPath(config.output.cleanDistPath);

      if (enable === 'auto') {
        // If no files are written to disk, we don't need to clean the output
        if (isDev && !config.dev.writeToDisk) {
          return undefined;
        }

        // only clean when the dist path is a subdir of root path
        if (isStrictSubdir(rootPath, distPath)) {
          return {
            path: distPath,
            keep,
          };
        }

        api.logger.warn('The dist path is not a subdir of root path, Rsbuild will not empty it.');
        api.logger.warn(`Please set ${color.yellow('`output.cleanDistPath`')} config manually.`);
        api.logger.warn(`Current root path: ${color.dim(rootPath)}`);
        api.logger.warn(`Current dist path: ${color.dim(distPath)}`);
        return undefined;
      }

      if (enable === true) {
        return {
          path: distPath,
          keep,
        };
      }

      return undefined;
    };

    const cleanAll = async (params: {
      environments: Record<string, EnvironmentContext>;
      isDev?: boolean;
    }) => {
      // dedupe environments by distPath
      const environments = Object.values(params.environments).reduce<EnvironmentContext[]>(
        (result, curr) => {
          if (!result.find((item) => item.distPath === curr.distPath)) {
            result.push(curr);
          }
          return result;
        },
        [],
      );

      const pathInfos: PathInfo[] = [
        ...environments.map((environment) => getPathInfo(environment, params.isDev)),
        getRsbuildOutputPath(),
      ].filter((pathInfo): pathInfo is PathInfo => !!pathInfo);

      // Use `for...of` to handle nested directories correctly
      for (const pathInfo of pathInfos) {
        // Users may mistakenly set `output.distPath.root` to '/'
        if (pathInfo.path === '/') {
          const prefix = color.dim('[rsbuild:cleanOutput]');
          throw new Error(
            `${prefix} Refusing to clean output at ${color.cyan(
              `"${pathInfo.path}"`,
            )}. Update ${color.yellow(
              '`output.distPath.root`',
            )} or set ${color.yellow('`output.cleanDistPath`')} to false.`,
          );
        }
        await emptyDir(pathInfo.path, api.logger, pathInfo.keep);
      }
    };

    api.onBeforeBuild(async ({ isFirstCompile, environments }) => {
      if (isFirstCompile) {
        await cleanAll({ environments });
      }
    });

    api.onBeforeStartDevServer(async ({ environments }) => {
      await cleanAll({ environments, isDev: true });
    });
  },
});
