import { existsSync } from 'node:fs';
import { isPromise } from 'node:util/types';
import { build as baseBuild } from './build';
import { createCompiler as baseCreateCompiler } from './createCompiler';
import { createContext } from './createContext';
import { castArray, color, getNodeEnv, isFunction, pick, setNodeEnv } from './helpers';
import { isEmptyDir } from './helpers/fs';
import { initConfigs as baseInitConfigs, initRsbuildConfig } from './initConfigs';
import { initPluginAPI } from './initPlugins';
import { inspectConfig as baseInspectConfig } from './inspectConfig';
import { type LoadEnvResult, loadEnv } from './loadEnv';
import { createLogger, defaultLogger, isDebug } from './logger';
import { createPluginManager } from './pluginManager';
import { pluginAppIcon } from './plugins/appIcon';
import { pluginAsset } from './plugins/asset';
import { pluginBasic } from './plugins/basic';
import { pluginCache } from './plugins/cache';
import { pluginCleanOutput } from './plugins/cleanOutput';
import { pluginCss } from './plugins/css';
import { pluginDefine } from './plugins/define';
import { pluginEntry } from './plugins/entry';
import { pluginExternals } from './plugins/externals';
import { pluginFileSize } from './plugins/fileSize';
import { pluginHtml } from './plugins/html';
import { pluginInlineChunk } from './plugins/inlineChunk';
import { pluginLazyCompilation } from './plugins/lazyCompilation';
import { pluginManifest } from './plugins/manifest';
import { pluginMinimize } from './plugins/minimize';
import { pluginModuleFederation } from './plugins/moduleFederation';
import { pluginNodeAddons } from './plugins/nodeAddons';
import { pluginNonce } from './plugins/nonce';
import { pluginOutput } from './plugins/output';
import { pluginProgress } from './plugins/progress';
import { pluginResolve } from './plugins/resolve';
import { pluginResourceHints } from './plugins/resourceHints';
import { pluginRsdoctor } from './plugins/rsdoctor';
import { pluginRspackProfile } from './plugins/rspackProfile';
import { pluginServer } from './plugins/server';
import { pluginSourceMap } from './plugins/sourceMap';
import { pluginSplitChunks } from './plugins/splitChunks';
import { pluginSri } from './plugins/sri';
import { pluginSwc } from './plugins/swc';
import { pluginTarget } from './plugins/target';
import { pluginWasm } from './plugins/wasm';
import { pluginWorker } from './plugins/worker';
import { createDevServer as baseCreateDevServer } from './server/devServer';
import { startPreviewServer } from './server/previewServer';
import type {
  Build,
  CreateCompiler,
  CreateDevServer,
  CreateRsbuildOptions,
  Falsy,
  InitConfigsOptions,
  InspectConfig,
  InternalContext,
  PluginManager,
  PreviewOptions,
  ResolvedCreateRsbuildOptions,
  RsbuildConfig,
  RsbuildInstance,
  RsbuildPlugin,
  RsbuildPlugins,
  StartDevServer,
  StartDevServerOptions,
} from './types';

function applyDefaultPlugins(pluginManager: PluginManager, context: InternalContext) {
  pluginManager.addPlugins([
    pluginBasic(),
    pluginEntry(),
    pluginSourceMap(),
    pluginCache(),
    pluginTarget(),
    pluginOutput(),
    pluginResolve(),
    pluginFileSize(context),
    // cleanOutput plugin should before the html plugin
    pluginCleanOutput(),
    pluginAsset(),
    pluginHtml(context),
    pluginAppIcon(),
    pluginWasm(),
    pluginNodeAddons(),
    pluginDefine(),
    pluginCss(),
    pluginMinimize(),
    pluginProgress(),
    pluginWorker(),
    pluginSwc(),
    pluginExternals(),
    pluginSplitChunks(),
    pluginInlineChunk(),
    pluginRsdoctor(),
    pluginResourceHints(),
    pluginServer(),
    pluginManifest(),
    pluginModuleFederation(),
    pluginRspackProfile(),
    pluginLazyCompilation(),
    pluginSri(),
    pluginNonce(),
  ]);
}

function applyEnvsToConfig(config: RsbuildConfig, envs: LoadEnvResult | null) {
  if (envs === null) {
    return;
  }

  // define the public environment variables
  config.source ||= {};
  config.source.define = {
    ...envs.publicVars,
    ...config.source.define,
  };

  if (envs.filePaths.length === 0) {
    return;
  }

  // watch the env files
  config.dev ||= {};
  config.dev.watchFiles = [
    ...(config.dev.watchFiles ? castArray(config.dev.watchFiles) : []),
    {
      paths: envs.filePaths,
      type: 'reload-server',
    },
  ];

  // add env files to build dependencies, so that the build cache
  // can be invalidated when the env files are changed.
  if (config.performance?.buildCache) {
    const { buildCache } = config.performance;
    if (buildCache === true) {
      config.performance.buildCache = {
        buildDependencies: envs.filePaths,
      };
    } else {
      buildCache.buildDependencies ||= [];
      buildCache.buildDependencies.push(...envs.filePaths);
    }
  }
}

/**
 * Create an Rsbuild instance.
 */
export async function createRsbuild(options: CreateRsbuildOptions = {}): Promise<RsbuildInstance> {
  const envs = options.loadEnv
    ? loadEnv({
        cwd: options.cwd,
        ...(typeof options.loadEnv === 'boolean' ? {} : options.loadEnv),
      })
    : null;

  const configOrFactory = options.config ?? options.rsbuildConfig;
  const config = isFunction(configOrFactory) ? await configOrFactory() : configOrFactory || {};

  const logger =
    config.customLogger ??
    // Inherit the default logger options and level,
    // but create a new instance to keep the logger instance isolated.
    createLogger({
      ...defaultLogger.options,
      level: defaultLogger.level,
    });

  // Apply `logLevel` from config if it's specified
  // Debug mode should always use verbose logs
  if (config.logLevel && !isDebug()) {
    logger.level = config.logLevel;
  }

  applyEnvsToConfig(config, envs);

  const resolvedOptions: ResolvedCreateRsbuildOptions = {
    cwd: process.cwd(),
    callerName: 'rsbuild',
    ...options,
    rsbuildConfig: config,
  };

  const pluginManager = createPluginManager(logger);

  const context = await createContext(resolvedOptions, config, logger);

  const getPluginAPI = initPluginAPI({ context, pluginManager });
  context.getPluginAPI = getPluginAPI;
  const globalPluginAPI = getPluginAPI();

  logger.debug('registering default plugins');
  applyDefaultPlugins(pluginManager, context);
  logger.debug('default plugins registered');

  const createCompiler = (async () => {
    initAction();
    const result = await baseCreateCompiler({
      context,
      pluginManager,
      rsbuildOptions: resolvedOptions,
    });
    return result.compiler;
  }) as CreateCompiler;

  const preview = async (options: PreviewOptions = {}) => {
    context.action = 'preview';

    if (!getNodeEnv()) {
      setNodeEnv('production');
    }

    const config = await initRsbuildConfig({ context, pluginManager });
    const { distPath } = context;
    const { checkDistDir = true } = options;

    if (checkDistDir) {
      if (!existsSync(distPath)) {
        throw new Error(
          `${color.dim('[rsbuild:preview]')} The output directory ${color.yellow(
            distPath,
          )} does not exist, please build the project before previewing.`,
        );
      }

      if (isEmptyDir(distPath)) {
        throw new Error(
          `${color.dim('[rsbuild:preview]')} The output directory ${color.yellow(
            distPath,
          )} is empty, please build the project before previewing.`,
        );
      }
    }

    return startPreviewServer(context, config, options);
  };

  const build: Build = async (options) => {
    context.action = 'build';

    if (!getNodeEnv()) {
      setNodeEnv('production');
    }

    const buildInstance = await baseBuild(
      { context, pluginManager, rsbuildOptions: resolvedOptions },
      options,
    );
    return {
      ...buildInstance,
      close: async () => {
        await context.hooks.onCloseBuild.callBatch();
        await buildInstance.close();
      },
    };
  };

  const startDevServer: StartDevServer = async (options?: StartDevServerOptions) => {
    context.action = 'dev';

    if (!getNodeEnv()) {
      setNodeEnv('development');
    }

    const config = await initRsbuildConfig({ context, pluginManager });
    const server = await baseCreateDevServer(
      { context, pluginManager, rsbuildOptions: resolvedOptions },
      createCompiler,
      config,
      options,
    );

    return server.listen();
  };

  const createDevServer: CreateDevServer = async (options) => {
    context.action = 'dev';

    if (!getNodeEnv()) {
      setNodeEnv('development');
    }

    const config = await initRsbuildConfig({ context, pluginManager });
    return baseCreateDevServer(
      { context, pluginManager, rsbuildOptions: resolvedOptions },
      createCompiler,
      config,
      options,
    );
  };

  const initAction = () => {
    if (!context.action) {
      context.action = config.mode === 'development' ? 'dev' : 'build';
    }
  };

  const inspectConfig: InspectConfig = async (inspectOptions) => {
    initAction();

    const { rspackConfigs } = await baseInitConfigs({
      context,
      pluginManager,
      rsbuildOptions: resolvedOptions,
    });

    return baseInspectConfig({
      context,
      pluginManager,
      rsbuildOptions: resolvedOptions,
      inspectOptions,
      bundlerConfigs: rspackConfigs,
    });
  };

  const initConfigs = async (options?: InitConfigsOptions) => {
    if (context.action && options?.action && context.action !== options.action) {
      // Calling initConfigs multiple times with different actions
      throw new Error(
        `\
[rsbuild] initConfigs() can only be called with the same action type.
  - Expected: ${context.action}
  - Actual: ${options?.action}`,
      );
    }

    if (options?.action) {
      context.action = options.action;
    }

    const { rspackConfigs } = await baseInitConfigs({
      context,
      pluginManager,
      rsbuildOptions: resolvedOptions,
    });
    return rspackConfigs;
  };

  const rsbuild: RsbuildInstance = {
    logger: context.logger,
    build,
    preview,
    startDevServer,
    createCompiler,
    createDevServer,
    inspectConfig,
    initConfigs,
    ...pick(pluginManager, ['addPlugins', 'getPlugins', 'removePlugins', 'isPluginExists']),
    ...pick(globalPluginAPI, [
      'context',
      'expose',
      'getRsbuildConfig',
      'getNormalizedConfig',
      'modifyEnvironmentConfig',
      'modifyRsbuildConfig',
      'onAfterBuild',
      'onAfterCreateCompiler',
      'onAfterDevCompile',
      'onAfterEnvironmentCompile',
      'onAfterStartDevServer',
      'onAfterStartPreviewServer',
      'onBeforeBuild',
      'onBeforeCreateCompiler',
      'onBeforeDevCompile',
      'onBeforeEnvironmentCompile',
      'onBeforeStartDevServer',
      'onBeforeStartPreviewServer',
      'onCloseBuild',
      'onCloseDevServer',
      'onDevCompileDone',
      'onExit',
    ]),
  };

  if (envs) {
    rsbuild.onCloseBuild(envs.cleanup);
    rsbuild.onCloseDevServer(envs.cleanup);
  }

  const getFlattenedPlugins = async (pluginOptions: RsbuildPlugins) => {
    let plugins = pluginOptions;
    do {
      plugins = (await Promise.all(plugins)).flat(Number.POSITIVE_INFINITY as 1);
    } while (plugins.some((v) => isPromise(v)));

    return plugins as (RsbuildPlugin | Falsy)[];
  };

  if (config.plugins) {
    const plugins = await getFlattenedPlugins(config.plugins);
    rsbuild.addPlugins(plugins);
  }

  // Register environment plugin
  if (config.environments) {
    await Promise.all(
      Object.entries(config.environments).map(async ([name, environmentConfig]) => {
        if (!environmentConfig.plugins) {
          return;
        }

        // If the current environment is not specified, skip it
        if (context.specifiedEnvironments && !context.specifiedEnvironments.includes(name)) {
          return;
        }

        const plugins = await getFlattenedPlugins(environmentConfig.plugins);
        rsbuild.addPlugins(plugins, {
          environment: name,
        });
      }),
    );
  }

  return rsbuild;
}
