import { rspack } from '@rspack/core';
import { reduceConfigsWithContext } from 'reduce-configs';
import { merge } from 'rspack-merge';
import { CHAIN_ID, modifyBundlerChain } from './configChain';
import { castArray, color, getNodeEnv } from './helpers';
import type { Logger } from './logger';
import { getHTMLPlugin } from './pluginHelper';
import type {
  ConfigChainAsyncWithContext,
  EnvironmentContext,
  InternalContext,
  ModifyChainUtils,
  ModifyRspackConfigUtils,
  NarrowedRspackConfig,
  RsbuildTarget,
  Rspack,
} from './types';

async function modifyRspackConfig(
  context: InternalContext,
  rspackConfig: Rspack.Configuration,
  chainUtils: ModifyChainUtils,
) {
  context.logger.debug('applying modifyRspackConfig hook');

  let currentConfig = rspackConfig;

  const utils = getConfigUtils(() => currentConfig, chainUtils);

  [currentConfig] = await context.hooks.modifyRspackConfig.callChain({
    environment: utils.environment.name,
    args: [rspackConfig as NarrowedRspackConfig, utils],
    afterEach: ([config]) => {
      currentConfig = config;
    },
  });

  if (utils.environment.config.tools?.rspack) {
    const toolsRspackConfig = utils.environment.config.tools.rspack as ConfigChainAsyncWithContext<
      NarrowedRspackConfig,
      ModifyRspackConfigUtils
    >;

    currentConfig = await reduceConfigsWithContext({
      initial: currentConfig as NarrowedRspackConfig,
      config: toolsRspackConfig,
      ctx: utils,
      mergeFn: (...args: Rspack.Configuration[]) => {
        // Update the reference of the current config
        currentConfig = utils.mergeConfig.call(utils, args);
        return currentConfig;
      },
    });
  }

  context.logger.debug('applied modifyRspackConfig hook');
  return currentConfig;
}

export function getConfigUtils(
  getCurrentConfig: () => Rspack.Configuration,
  chainUtils: ModifyChainUtils,
): ModifyRspackConfigUtils {
  return {
    ...chainUtils,

    mergeConfig: merge,

    addRules(rules) {
      const config = getCurrentConfig();
      const ruleArr = castArray(rules);
      if (!config.module) {
        config.module = {};
      }
      if (!config.module.rules) {
        config.module.rules = [];
      }
      config.module.rules.unshift(...ruleArr);
    },

    appendRules(rules) {
      const config = getCurrentConfig();
      const ruleArr = castArray(rules);
      if (!config.module) {
        config.module = {};
      }
      if (!config.module.rules) {
        config.module.rules = [];
      }
      config.module.rules.push(...ruleArr);
    },

    prependPlugins(plugins) {
      const config = getCurrentConfig();
      const pluginArr = castArray(plugins);
      if (!config.plugins) {
        config.plugins = [];
      }
      config.plugins.unshift(...pluginArr);
    },

    appendPlugins(plugins) {
      const config = getCurrentConfig();
      const pluginArr = castArray(plugins);
      if (!config.plugins) {
        config.plugins = [];
      }
      config.plugins.push(...pluginArr);
    },

    removePlugin(pluginName) {
      const config = getCurrentConfig();
      if (!config.plugins) {
        return;
      }
      config.plugins = config.plugins.filter((plugin) => {
        if (!plugin) {
          return true;
        }
        const name = plugin.name || plugin.constructor.name;
        return name !== pluginName;
      });
    },
  };
}

export function getChainUtils(
  target: RsbuildTarget,
  environment: EnvironmentContext,
  environments: Record<string, EnvironmentContext>,
): ModifyChainUtils {
  const nodeEnv = getNodeEnv();

  return {
    rspack,
    environment,
    environments,
    env: nodeEnv,
    target,
    isDev: environment.config.mode === 'development',
    isProd: environment.config.mode === 'production',
    isServer: target === 'node',
    isWebWorker: target === 'web-worker',
    CHAIN_ID,
    HtmlPlugin: getHTMLPlugin(environment.config),
  };
}

function validateRspackConfig(config: Rspack.Configuration, logger: Logger) {
  // validate plugins
  if (config.plugins) {
    for (const plugin of config.plugins) {
      if (plugin && plugin.apply === undefined && 'name' in plugin && 'setup' in plugin) {
        const name = color.bold(color.yellow(plugin.name));
        throw new Error(
          `${color.dim('[rsbuild:plugin]')} "${color.yellow(name)}" appears to be an Rsbuild plugin. It cannot be used as an Rspack plugin.`,
        );
      }
    }
  }

  if (config.devServer) {
    logger.warn(
      `${color.dim('[rsbuild:config]')} Find invalid Rspack config: "${color.yellow(
        'devServer',
      )}". Note that Rspack's "devServer" config is not supported by Rsbuild. You can use Rsbuild's "dev" config to configure the Rsbuild dev server.`,
    );
  }
}

export async function generateRspackConfig({
  target,
  context,
  environmentName,
}: {
  target: RsbuildTarget;
  context: InternalContext;
  environmentName: string;
}): Promise<Rspack.Configuration> {
  const chainUtils = getChainUtils(
    target,
    context.environments[environmentName],
    context.environments,
  );

  const chain = await modifyBundlerChain(context, {
    ...chainUtils,
    bundler: rspack,
  });

  let rspackConfig = chain.toConfig();

  rspackConfig = await modifyRspackConfig(context, rspackConfig, chainUtils);

  validateRspackConfig(rspackConfig, context.logger);

  return rspackConfig;
}
