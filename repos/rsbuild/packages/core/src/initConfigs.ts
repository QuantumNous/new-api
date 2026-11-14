import { JS_DIST_DIR } from './constants';
import { updateContextByNormalizedConfig, updateEnvironmentContext } from './createContext';
import { getDefaultEntry, normalizeConfig } from './defaultConfig';
import { camelCase, color, pick } from './helpers';
import { ensureAbsolutePath } from './helpers/path';
import { inspectConfig } from './inspectConfig';
import { isDebug } from './logger';
import { mergeRsbuildConfig } from './mergeConfig';
import { initPlugins } from './pluginManager';
import { generateRspackConfig } from './rspackConfig';
import type {
  AllowedEnvironmentDevKeys,
  EnvironmentConfig,
  InspectConfigOptions,
  InternalContext,
  MergedEnvironmentConfig,
  ModifyEnvironmentConfigUtils,
  NormalizedConfig,
  NormalizedEnvironmentConfig,
  PluginManager,
  ResolvedCreateRsbuildOptions,
  RsbuildEntry,
  Rspack,
} from './types';

const allowedEnvironmentDevKeys: AllowedEnvironmentDevKeys[] = [
  'hmr',
  'client',
  'liveReload',
  'browserLogs',
  'writeToDisk',
  'assetPrefix',
  'progressBar',
  'lazyCompilation',
];

async function modifyRsbuildConfig(context: InternalContext) {
  context.logger.debug('applying modifyRsbuildConfig hook');

  const pluginsCount = context.config.plugins?.length ?? 0;
  const [modified] = await context.hooks.modifyRsbuildConfig.callChain(context.config, {
    mergeRsbuildConfig,
  });
  context.config = modified;

  const newPluginsCount = modified.plugins?.length ?? 0;
  if (newPluginsCount !== pluginsCount) {
    context.logger.warn(
      `${color.dim('[rsbuild]')} Cannot change plugins via ${color.yellow(
        'modifyRsbuildConfig',
      )} as plugins are already initialized when it executes.`,
    );
  }

  context.logger.debug('applied modifyRsbuildConfig hook');
}

async function modifyEnvironmentConfig(
  context: InternalContext,
  config: MergedEnvironmentConfig,
  name: string,
) {
  context.logger.debug(`applying modifyEnvironmentConfig hook (${name})`);

  const [modified] = await context.hooks.modifyEnvironmentConfig.callChain({
    environment: name,
    args: [
      config,
      {
        name,
        mergeEnvironmentConfig:
          mergeRsbuildConfig<MergedEnvironmentConfig> as ModifyEnvironmentConfigUtils['mergeEnvironmentConfig'],
      },
    ],
  });

  context.logger.debug(`applied modifyEnvironmentConfig hook (${name})`);

  return modified;
}

export type InitConfigsOptions = {
  context: InternalContext;
  pluginManager: PluginManager;
  rsbuildOptions: ResolvedCreateRsbuildOptions;
};

const createEnvironmentNotFoundError = (environments: string[] = []) => {
  const envList = color.yellow(environments.join(','));
  return new Error(
    `${color.dim('[rsbuild:config]')} The current build is specified to run only in the ${envList} environment, but the configuration of the specified environment was not found.`,
  );
};

const initEnvironmentConfigs = (
  normalizedConfig: Omit<NormalizedConfig, 'environments'> & {
    environments: Record<string, EnvironmentConfig>;
  },
  rootPath: string,
  specifiedEnvironments?: string[],
): Record<string, MergedEnvironmentConfig> => {
  let defaultEntry: RsbuildEntry;

  const getDefaultEntryWithMemo = () => {
    if (!defaultEntry) {
      defaultEntry = getDefaultEntry(rootPath);
    }
    return defaultEntry;
  };

  const { environments, dev, server: _server, ...baseConfig } = normalizedConfig;

  const isEnvironmentEnabled = (name: string) =>
    !specifiedEnvironments || specifiedEnvironments.includes(name);

  const baseEnvironmentConfig = {
    ...baseConfig,
    dev: pick(dev, allowedEnvironmentDevKeys),
  };

  const applyEnvironmentDefaultConfig = (config: MergedEnvironmentConfig) => {
    if (!config.source.entry || Object.keys(config.source.entry).length === 0) {
      config.source.entry = getDefaultEntryWithMemo();
    }

    const isServer = config.output.target === 'node';
    if (config.output.distPath.js === undefined) {
      config.output.distPath.js = isServer ? '' : JS_DIST_DIR;
    }

    // For node target, default to ESM output
    if (config.output.module === undefined) {
      config.output.module = isServer;
    }

    // For `web` and `web-worker` targets, minify is true by default in production mode
    // For `node` target, minify is false by default
    if (config.output.minify === undefined) {
      config.output.minify = !isServer;
    }

    return config;
  };

  if (environments && Object.keys(environments).length > 0) {
    const resolvedEnvironments = Object.fromEntries(
      Object.entries(environments)
        .filter(([name]) => isEnvironmentEnabled(name))
        .map(([name, config]) => {
          const environmentConfig = mergeRsbuildConfig(
            baseEnvironmentConfig,
            config,
          ) as unknown as MergedEnvironmentConfig;

          return [name, applyEnvironmentDefaultConfig(environmentConfig)];
        }),
    );

    if (Object.keys(resolvedEnvironments).length === 0) {
      throw createEnvironmentNotFoundError(specifiedEnvironments);
    }
    return resolvedEnvironments;
  }

  const defaultEnvironmentName = camelCase(baseConfig.output.target);

  if (!isEnvironmentEnabled(defaultEnvironmentName)) {
    throw createEnvironmentNotFoundError(specifiedEnvironments);
  }

  return {
    [defaultEnvironmentName]: applyEnvironmentDefaultConfig(
      baseEnvironmentConfig as MergedEnvironmentConfig,
    ),
  };
};

const validateRsbuildConfig = (context: InternalContext, config: NormalizedConfig) => {
  if (config.server.base && !config.server.base.startsWith('/')) {
    throw new Error(
      `${color.dim('[rsbuild:config]')} The ${color.yellow(
        '"server.base"',
      )} option should start with a slash, for example: "/base"`,
    );
  }

  if (!config.environments) {
    return;
  }

  const environmentNames = Object.keys(config.environments);
  const environmentNameRegexp = /^[\w$-]+$/;
  const validTargets = ['web', 'node', 'web-worker'];

  for (const name of environmentNames) {
    // ensure environment names are filesystem and property access safe
    if (!environmentNameRegexp.test(name)) {
      context.logger.warn(
        `${color.dim('[rsbuild:config]')} Environment name "${color.yellow(name)}" contains invalid characters. Only letters, numbers, "-", "_", and "$" are allowed.`,
      );
    }

    const outputConfig = config.environments[name].output;
    if (outputConfig.target) {
      if (!validTargets.includes(outputConfig.target)) {
        throw new Error(
          `${color.dim('[rsbuild:config]')} Invalid value of ${color.yellow(
            'output.target',
          )}: ${color.yellow(`"${outputConfig.target}"`)}, valid values are: ${color.yellow(
            validTargets.join(', '),
          )}`,
        );
      }
    }
  }
};

/**
 * Initialize the Rsbuild config
 * 1. Initialize the Rsbuild plugins
 * 2. Run all the `modifyRsbuildConfig` hooks
 * 3. Normalize the Rsbuild config, merge with the default config
 * 4. Initialize the configs for each environment
 * 5. Run all the `modifyEnvironmentConfig` hooks
 * 6. Validate the final Rsbuild config
 */
export async function initRsbuildConfig({
  context,
  pluginManager,
}: Pick<InitConfigsOptions, 'context' | 'pluginManager'>): Promise<NormalizedConfig> {
  // initialized
  if (context.normalizedConfig) {
    return context.normalizedConfig;
  }

  await initPlugins({
    context,
    pluginManager,
  });

  await modifyRsbuildConfig(context);

  const normalizedBaseConfig = normalizeConfig(context.config, context.rootPath);
  const environments: Record<string, NormalizedEnvironmentConfig> = {};

  const mergedEnvironments = initEnvironmentConfigs(
    normalizedBaseConfig,
    context.rootPath,
    context.specifiedEnvironments,
  );

  const tsconfigPaths = new Set<string>();

  for (const [name, config] of Object.entries(mergedEnvironments)) {
    const environmentConfig = await modifyEnvironmentConfig(context, config, name);

    const normalizedEnvironmentConfig = {
      ...environmentConfig,
      dev: {
        ...normalizedBaseConfig.dev,
        ...environmentConfig.dev,
      },
      server: normalizedBaseConfig.server,
    };

    const { tsconfigPath } = normalizedEnvironmentConfig.source;

    // Ensure the `tsconfigPath` is an absolute path
    if (tsconfigPath) {
      const absoluteTsconfigPath = ensureAbsolutePath(context.rootPath, tsconfigPath);
      normalizedEnvironmentConfig.source.tsconfigPath = absoluteTsconfigPath;
      tsconfigPaths.add(absoluteTsconfigPath);
    }

    environments[name] = normalizedEnvironmentConfig;
  }

  // watch tsconfig files and restart server when tsconfig files changed
  // to ensure `paths` alias can be updated
  if (tsconfigPaths.size && normalizedBaseConfig.resolve.aliasStrategy === 'prefer-tsconfig') {
    normalizedBaseConfig.dev.watchFiles.push({
      paths: Array.from(tsconfigPaths),
      type: 'reload-server',
    });
  }

  context.normalizedConfig = {
    ...normalizedBaseConfig,
    environments,
  };

  await updateEnvironmentContext(context, environments);
  updateContextByNormalizedConfig(context);
  validateRsbuildConfig(context, context.normalizedConfig);

  return context.normalizedConfig;
}

export async function initConfigs({
  context,
  pluginManager,
  rsbuildOptions,
}: InitConfigsOptions): Promise<{
  rspackConfigs: Rspack.Configuration[];
}> {
  const normalizedConfig = await initRsbuildConfig({ context, pluginManager });

  const rspackConfigs: Rspack.Configuration[] = [];

  // Generate Rspack configs sequentially to ensure deterministic ordering and stable results
  for (const [environmentName, config] of Object.entries(normalizedConfig.environments)) {
    rspackConfigs.push(
      await generateRspackConfig({
        target: config.output.target,
        context,
        environmentName,
      }),
    );
  }

  // write Rsbuild config and Rspack config to disk in debug mode
  if (isDebug()) {
    const inspect = async () => {
      const inspectOptions: InspectConfigOptions = {
        verbose: true,
        writeToDisk: true,
      };
      await inspectConfig({
        context,
        pluginManager,
        inspectOptions,
        rsbuildOptions,
        bundlerConfigs: rspackConfigs,
      });
    };

    // run inspect later to avoid cleaned by cleanOutput plugin
    context.hooks.onBeforeBuild.tap(async ({ isFirstCompile }) => {
      if (isFirstCompile) {
        await inspect();
      }
    });
    context.hooks.onAfterStartDevServer.tap(inspect);
  }

  return {
    rspackConfigs,
  };
}
