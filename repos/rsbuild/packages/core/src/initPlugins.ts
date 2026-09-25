import { join, posix } from 'node:path';
import { type Compiler, rspack } from '@rspack/core';
import { LOADER_PATH } from './constants';
import { createPublicContext } from './createContext';
import { color, getFilename } from './helpers';
import { exitHook } from './helpers/exitHook';
import { removeLeadingSlash } from './helpers/url';
import type { TransformLoaderOptions } from './loader/transformLoader';
import type { Logger } from './logger';
import { isEnvironmentMatch } from './pluginManager';
import type {
  GetRsbuildConfig,
  InternalContext,
  NormalizedConfig,
  NormalizedEnvironmentConfig,
  PluginManager,
  ProcessAssetsDescriptor,
  ProcessAssetsHandler,
  ProcessAssetsHook,
  ProcessAssetsStage,
  ResolveHandler,
  ResolveHook,
  RsbuildPluginAPI,
  TransformHandler,
  TransformHook,
} from './types';

export function getHTMLPathByEntry(
  entryName: string,
  config: NormalizedEnvironmentConfig,
  logger: Logger,
): string {
  const filename = getFilename(config, 'html').replace('[name]', entryName);
  const prefix = config.output.distPath.html;

  if (prefix.startsWith('/')) {
    logger.warn(
      `${color.dim('[rsbuild:config]')} Absolute path is not recommended at ${color.yellow(`output.distPath.html: "${prefix}"`)}, use relative path instead.`,
    );
  }

  return removeLeadingSlash(posix.join(prefix, filename));
}

const mapProcessAssetsStage = (stage: ProcessAssetsStage) => {
  const { Compilation } = rspack;
  switch (stage) {
    case 'additional':
      return Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL;
    case 'pre-process':
      return Compilation.PROCESS_ASSETS_STAGE_PRE_PROCESS;
    case 'derived':
      return Compilation.PROCESS_ASSETS_STAGE_DERIVED;
    case 'additions':
      return Compilation.PROCESS_ASSETS_STAGE_ADDITIONS;
    case 'none':
      return Compilation.PROCESS_ASSETS_STAGE_NONE;
    case 'optimize':
      return Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE;
    case 'optimize-count':
      return Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_COUNT;
    case 'optimize-compatibility':
      return Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_COMPATIBILITY;
    case 'optimize-size':
      return Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE;
    case 'dev-tooling':
      return Compilation.PROCESS_ASSETS_STAGE_DEV_TOOLING;
    case 'optimize-inline':
      return Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_INLINE;
    case 'summarize':
      return Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE;
    case 'optimize-hash':
      return Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_HASH;
    case 'optimize-transfer':
      return Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_TRANSFER;
    case 'analyse':
      return Compilation.PROCESS_ASSETS_STAGE_ANALYSE;
    case 'report':
      return Compilation.PROCESS_ASSETS_STAGE_REPORT;
    default:
      throw new Error(`${color.dim('[rsbuild]')} Invalid process assets stage: ${stage}`);
  }
};

export function initPluginAPI({
  context,
  pluginManager,
}: {
  context: InternalContext;
  pluginManager: PluginManager;
}): (environment?: string) => RsbuildPluginAPI {
  const { hooks } = context;
  const publicContext = createPublicContext(context);

  function getNormalizedConfig(): NormalizedConfig;
  function getNormalizedConfig(options: { environment: string }): NormalizedEnvironmentConfig;
  function getNormalizedConfig(options?: { environment: string }) {
    if (context.normalizedConfig) {
      if (options?.environment) {
        const config = context.normalizedConfig.environments[options.environment];

        if (!config) {
          throw new Error(
            `${color.dim('[rsbuild]')} Cannot find normalized config by environment: ${options.environment}.`,
          );
        }
        return config;
      }
      return context.normalizedConfig;
    }
    throw new Error(
      `${color.dim('[rsbuild]')} Cannot access normalized config until ${color.yellow(
        'modifyRsbuildConfig',
      )} is called.`,
    );
  }

  const getRsbuildConfig = ((type = 'current') => {
    switch (type) {
      case 'original':
        return context.originalConfig;
      case 'current':
        return context.config;
      case 'normalized':
        return getNormalizedConfig();
      default:
        throw new Error(
          `${color.dim('[rsbuild]')} ${color.yellow('getRsbuildConfig')} received an invalid type parameter.`,
        );
    }
  }) as GetRsbuildConfig;

  const GLOBAL_EXPOSED_KEY = Symbol('global-exposed');

  const exposed = new Map<string | symbol, Map<string | symbol, unknown>>();

  const expose: RsbuildPluginAPI['expose'] = (id, api, options) => {
    const exposedAPIs = exposed.get(id) ?? new Map<string | symbol, unknown>();
    const key = options?.environment ?? GLOBAL_EXPOSED_KEY;

    exposedAPIs.set(key, api);
    exposed.set(id, exposedAPIs);
  };

  const createUseExposed =
    (currentEnvironment?: string): RsbuildPluginAPI['useExposed'] =>
    <T>(id: string | symbol) => {
      const exposedAPIs = exposed.get(id);

      if (!exposedAPIs) {
        return undefined;
      }

      if (currentEnvironment !== undefined && exposedAPIs.has(currentEnvironment)) {
        return exposedAPIs.get(currentEnvironment) as T;
      }

      return exposedAPIs.get(GLOBAL_EXPOSED_KEY) as T | undefined;
    };

  let transformId = 0;
  const transformer: Record<string, TransformHandler<boolean>> = {};
  const processAssetsFns: {
    environment?: string;
    descriptor: ProcessAssetsDescriptor;
    handler: ProcessAssetsHandler;
  }[] = [];

  const resolveFns: {
    environment?: string;
    handler: ResolveHandler;
  }[] = [];

  hooks.modifyBundlerChain.tap((chain, { target, environment }) => {
    const pluginName = 'RsbuildCorePlugin';

    /**
     * Transform Rsbuild plugin hooks to Rspack plugin hooks
     */
    class RsbuildCorePlugin {
      name = pluginName;

      apply(compiler: Compiler): void {
        compiler.__rsbuildTransformer = transformer;

        for (const { handler, environment: pluginEnvironment } of resolveFns) {
          if (pluginEnvironment && !isEnvironmentMatch(pluginEnvironment, environment.name)) {
            continue;
          }

          compiler.hooks.compilation.tap(pluginName, (compilation, { normalModuleFactory }) => {
            normalModuleFactory.hooks.resolve.tapPromise(pluginName, async (resolveData) =>
              handler({
                compiler,
                compilation,
                environment,
                resolveData,
              }),
            );
          });
        }

        compiler.hooks.thisCompilation.tap(pluginName, (compilation) => {
          compilation.hooks.childCompiler.tap(pluginName, (childCompiler) => {
            childCompiler.__rsbuildTransformer = transformer;
          });

          const { sources } = rspack;

          for (const { descriptor, handler, environment: pluginEnvironment } of processAssetsFns) {
            // filter by targets
            if (descriptor.targets && !descriptor.targets.includes(target)) {
              continue;
            }

            // filter by environments
            if (
              (descriptor.environments && !descriptor.environments.includes(environment.name)) ||
              // the plugin is registered in a specific environment config
              (pluginEnvironment && !isEnvironmentMatch(pluginEnvironment, environment.name))
            ) {
              continue;
            }

            compilation.hooks.processAssets.tapPromise(
              {
                name: pluginName,
                stage: mapProcessAssetsStage(descriptor.stage),
              },
              async (assets) =>
                handler({
                  assets,
                  compiler,
                  compilation,
                  environment,
                  sources,
                }),
            );
          }
        });
      }
    }

    chain.plugin(pluginName).use(RsbuildCorePlugin);
  });

  const getTransformHook: (environment?: string) => TransformHook =
    (environment) => (descriptor, handler) => {
      const id = `rsbuild-transform-${transformId++}`;

      transformer[id] = handler;

      hooks.modifyBundlerChain.tapEnvironment({
        environment,
        handler: (chain, { target, environment: environmentContext }) => {
          // filter by targets
          if (descriptor.targets && !descriptor.targets.includes(target)) {
            return;
          }

          // filter by environments
          if (
            descriptor.environments &&
            !descriptor.environments.includes(environmentContext.name)
          ) {
            return;
          }

          const rule = chain.module.rule(id);

          if (descriptor.test) {
            rule.test(descriptor.test);
          }
          if (descriptor.resourceQuery) {
            rule.resourceQuery(descriptor.resourceQuery);
          }
          if (descriptor.layer) {
            rule.layer(descriptor.layer);
          }
          if (descriptor.issuerLayer) {
            rule.issuerLayer(descriptor.issuerLayer);
          }
          if (descriptor.issuer) {
            rule.issuer(descriptor.issuer);
          }
          if (descriptor.with) {
            rule.with(descriptor.with);
          }
          if (descriptor.mimetype) {
            rule.mimetype(descriptor.mimetype);
          }

          if (descriptor.order && descriptor.order !== 'default') {
            rule.enforce(descriptor.order);
          } else if (descriptor.enforce) {
            rule.enforce(descriptor.enforce);
          }

          const loaderName = descriptor.raw ? 'transformRawLoader.mjs' : 'transformLoader.mjs';
          const loaderPath = join(LOADER_PATH, loaderName);

          rule
            .use(id)
            .loader(loaderPath)
            .options({
              id,
              getEnvironment: () => environmentContext,
            } satisfies TransformLoaderOptions);
        },
      });
    };

  const setProcessAssets: (environment?: string) => ProcessAssetsHook =
    (environment) => (descriptor, handler) => {
      processAssetsFns.push({ environment, descriptor, handler });
    };

  const setResolve: (environment?: string) => ResolveHook = (environment) => (handler) => {
    resolveFns.push({ environment, handler });
  };

  let onExitListened = false;

  const onExit: typeof hooks.onExit.tap = (cb) => {
    if (!onExitListened) {
      exitHook((exitCode) => {
        hooks.onExit.callBatch({ exitCode });
      });
      onExitListened = true;
    }
    hooks.onExit.tap(cb);
  };

  // Each plugin returns different APIs depending on the registered environment info.
  return (environment?: string) => ({
    context: publicContext,
    expose,
    logger: context.logger,
    transform: getTransformHook(environment),
    useExposed: createUseExposed(environment),
    processAssets: setProcessAssets(environment),
    resolve: setResolve(environment),
    getRsbuildConfig,
    getNormalizedConfig,
    isPluginExists: pluginManager.isPluginExists,

    // Hooks
    onExit,
    onAfterBuild: hooks.onAfterBuild.tap,
    onCloseBuild: hooks.onCloseBuild.tap,
    onBeforeBuild: hooks.onBeforeBuild.tap,
    onCloseDevServer: hooks.onCloseDevServer.tap,
    onBeforeDevCompile: hooks.onBeforeDevCompile.tap,
    onAfterDevCompile: hooks.onAfterDevCompile.tap,
    // alias for `onAfterDevCompile`
    onDevCompileDone: hooks.onAfterDevCompile.tap,
    onAfterCreateCompiler: hooks.onAfterCreateCompiler.tap,
    onAfterStartDevServer: hooks.onAfterStartDevServer.tap,
    onBeforeCreateCompiler: hooks.onBeforeCreateCompiler.tap,
    onBeforeStartDevServer: hooks.onBeforeStartDevServer.tap,
    onAfterStartPreviewServer: hooks.onAfterStartPreviewServer.tap,
    onBeforeStartPreviewServer: hooks.onBeforeStartPreviewServer.tap,
    modifyRsbuildConfig: hooks.modifyRsbuildConfig.tap,
    modifyHTML: (handler) => {
      hooks.modifyHTML.tapEnvironment({
        environment,
        handler,
      });
    },
    modifyHTMLTags: (handler) => {
      hooks.modifyHTMLTags.tapEnvironment({
        environment,
        handler,
      });
    },
    modifyBundlerChain: (handler) => {
      hooks.modifyBundlerChain.tapEnvironment({
        environment,
        handler,
      });
    },
    modifyRspackConfig: (handler) => {
      hooks.modifyRspackConfig.tapEnvironment({
        environment,
        handler,
      });
    },
    modifyEnvironmentConfig: (handler) => {
      hooks.modifyEnvironmentConfig.tapEnvironment({
        environment,
        handler,
      });
    },
    onAfterEnvironmentCompile: (handler) => {
      hooks.onAfterEnvironmentCompile.tapEnvironment({
        environment,
        handler,
      });
    },
    onBeforeEnvironmentCompile: (handler) => {
      hooks.onBeforeEnvironmentCompile.tapEnvironment({
        environment,
        handler,
      });
    },
  });
}
