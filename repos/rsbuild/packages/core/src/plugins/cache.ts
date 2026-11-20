import { isAbsolute, join } from 'node:path';
import { hash } from '../helpers';
import { findExists, isFileExists } from '../helpers/fs';
import type {
  BuildCacheOptions,
  EnvironmentContext,
  NormalizedEnvironmentConfig,
  RsbuildContext,
  RsbuildPlugin,
} from '../types';

function getCacheDirectory({ cacheDirectory }: BuildCacheOptions, context: RsbuildContext) {
  if (cacheDirectory) {
    return isAbsolute(cacheDirectory) ? cacheDirectory : join(context.rootPath, cacheDirectory);
  }
  return join(context.cachePath, 'rspack');
}

/**
 * Rspack can't detect the changes of framework config, tsconfig, tailwind config and browserslist config.
 * but they will affect the compilation result, so they need to be added to buildDependencies.
 */
async function getBuildDependencies(
  context: Readonly<RsbuildContext>,
  config: NormalizedEnvironmentConfig,
  environmentContext: EnvironmentContext,
  additionalDependencies?: string[],
) {
  const rootPackageJson = join(context.rootPath, 'package.json');
  const browserslistConfig = join(context.rootPath, '.browserslistrc');

  const buildDependencies: Record<string, string[]> = {};

  if (await isFileExists(rootPackageJson)) {
    buildDependencies.packageJson = [rootPackageJson];
  }
  const { tsconfigPath } = environmentContext;

  if (tsconfigPath) {
    buildDependencies.tsconfig = [tsconfigPath];
  }

  if (config._privateMeta?.configFilePath) {
    buildDependencies.rsbuildConfig = [config._privateMeta.configFilePath];
  }

  if (await isFileExists(browserslistConfig)) {
    buildDependencies.browserslistrc = [browserslistConfig];
  }

  const tailwindExts = ['ts', 'js', 'cjs', 'mjs'];
  const configs = tailwindExts.map((ext) => join(context.rootPath, `tailwind.config.${ext}`));
  const tailwindConfig = findExists(configs);

  if (tailwindConfig) {
    buildDependencies.tailwindcss = [tailwindConfig];
  }

  if (additionalDependencies) {
    buildDependencies.additional = additionalDependencies;
  }

  return buildDependencies;
}

export const pluginCache = (): RsbuildPlugin => ({
  name: 'rsbuild:cache',

  setup(api) {
    let cacheEnabled = false;

    api.modifyBundlerChain(async (chain, { environment, env }) => {
      const { config } = environment;
      const { buildCache = false } = config.performance;

      if (buildCache === false) {
        return;
      }

      cacheEnabled = true;

      const { context } = api;
      const cacheConfig = typeof buildCache === 'boolean' ? {} : buildCache;
      const cacheDirectory = getCacheDirectory(cacheConfig, context);
      const buildDependencies = await getBuildDependencies(
        context,
        config,
        environment,
        cacheConfig.buildDependencies,
      );

      const useDigest = Array.isArray(cacheConfig.cacheDigest) && cacheConfig.cacheDigest.length;

      // set cache name to avoid cache conflicts between different environments
      const cacheVersion = useDigest
        ? `${environment.name}-${env}-${await hash(JSON.stringify(cacheConfig.cacheDigest))}`
        : `${environment.name}-${env}`;

      chain.cache({
        type: 'persistent',
        version: cacheVersion,
        storage: {
          type: 'filesystem',
          directory: cacheDirectory,
        },
        buildDependencies: Object.values(buildDependencies).flat(),
      });
    });

    api.onAfterCreateCompiler(() => {
      if (cacheEnabled) {
        api.logger.debug('Rspack persistent cache enabled');
      }
    });
  },
});
