import { color, isFunction } from './helpers';
import type { Logger } from './logger';
import type {
  AddPlugins,
  InternalContext,
  PluginManager,
  PluginMeta,
  RsbuildPlugin,
  Rspack,
} from './types';

function validatePlugin(plugin: unknown) {
  const type = typeof plugin;

  if (type !== 'object' || plugin === null) {
    throw new Error(
      `${color.dim('[rsbuild:plugin]')} Expect Rsbuild plugin instance to be an object, but got ${color.yellow(
        type,
      )}.`,
    );
  }

  if (isFunction((plugin as RsbuildPlugin).setup)) {
    return;
  }

  if (isFunction((plugin as Rspack.RspackPluginInstance).apply)) {
    const { name = 'SomeWebpackPlugin' } =
      (plugin as Rspack.RspackPluginInstance).constructor || {};

    const messages = [
      `${color.yellow(name)} looks like a webpack or Rspack plugin, please use ${color.yellow(
        '`tools.rspack`',
      )} to register it:`,
      color.green(`
  // rsbuild.config.ts
  export default {
    tools: {
      rspack: {
        plugins: [new ${name}()]
      }
    }
  };
`),
    ];

    throw new Error(messages.join('\n'));
  }

  throw new Error(
    `${color.dim('[rsbuild:plugin]')} Expect the setup function of Rsbuild plugin to be a function, but got ${color.yellow(
      type,
    )}.`,
  );
}

/**
 * Determines whether the plugin is registered in the specified environment.
 * If the pluginEnvironment is undefined, it means it can match any environment.
 */
export const isEnvironmentMatch = (
  pluginEnvironment?: string,
  specifiedEnvironment?: string,
): boolean => pluginEnvironment === specifiedEnvironment || pluginEnvironment === undefined;

export function createPluginManager(logger: Logger): PluginManager {
  let plugins: PluginMeta[] = [];

  const addPlugins: AddPlugins = (newPlugins, options) => {
    const { before, environment } = options || {};

    for (const newPlugin of newPlugins) {
      if (!newPlugin) {
        continue;
      }

      validatePlugin(newPlugin);

      if (before) {
        const index = plugins.findIndex((item) => item.instance.name === before);
        if (index === -1) {
          logger.warn(`Plugin "${before}" does not exist.`);
          plugins.push({
            environment,
            instance: newPlugin,
          });
        } else {
          plugins.splice(index, 0, {
            environment,
            instance: newPlugin,
          });
        }
      } else {
        plugins.push({
          environment,
          instance: newPlugin,
        });
      }
    }
  };

  const removePlugins = (pluginNames: string[], options: { environment?: string } = {}) => {
    plugins = plugins.filter(
      (plugin) =>
        !(
          pluginNames.includes(plugin.instance.name) &&
          (!options.environment || plugin.environment === options.environment)
        ),
    );
  };

  const isPluginExists = (pluginName: string, options: { environment?: string } = {}) =>
    plugins.some(
      (plugin) =>
        plugin.instance.name === pluginName &&
        isEnvironmentMatch(plugin.environment, options.environment),
    );

  const getPlugins = (options: { environment?: string } = {}) => {
    return plugins
      .filter((plugin) => isEnvironmentMatch(plugin.environment, options.environment))
      .map(({ instance }) => instance);
  };

  return {
    getPlugins,
    getAllPluginsWithMeta: () => plugins,
    addPlugins,
    removePlugins,
    isPluginExists,
  };
}

/**
 * Sorts plugins by their `enforce` property.
 */
export const sortPluginsByEnforce = (plugins: PluginMeta[]): PluginMeta[] => {
  const prePlugins: PluginMeta[] = [];
  const normalPlugins: PluginMeta[] = [];
  const postPlugins: PluginMeta[] = [];

  for (const plugin of plugins) {
    const { enforce } = plugin.instance;

    if (enforce === 'pre') {
      prePlugins.push(plugin);
    } else if (enforce === 'post') {
      postPlugins.push(plugin);
    } else {
      normalPlugins.push(plugin);
    }
  }

  return [...prePlugins, ...normalPlugins, ...postPlugins];
};

/**
 * Performs topological sorting on plugins based on their dependencies.
 * Uses the `pre` and `post` properties of plugins to determine the correct
 * execution order.
 */
export const sortPluginsByDependencies = (plugins: PluginMeta[]): PluginMeta[] => {
  let allLines: [string, string][] = [];

  function getPlugin(name: string) {
    const targets = plugins.filter((item) => item.instance.name === name);
    if (!targets.length) {
      throw new Error(
        `${color.dim('[rsbuild:plugin]')} Plugin "${color.yellow(name)}" not existed`,
      );
    }
    return targets;
  }

  for (const plugin of plugins) {
    if (plugin.instance.pre) {
      for (const pre of plugin.instance.pre) {
        if (pre && plugins.some((item) => item.instance.name === pre)) {
          allLines.push([pre, plugin.instance.name]);
        }
      }
    }

    if (plugin.instance.post) {
      for (const post of plugin.instance.post) {
        if (post && plugins.some((item) => item.instance.name === post)) {
          allLines.push([plugin.instance.name, post]);
        }
      }
    }
  }

  // search the zero input plugin
  let zeroEndPoints = plugins.filter((item) => !allLines.find((l) => l[1] === item.instance.name));

  const sortedPoint: PluginMeta[] = [];

  while (zeroEndPoints.length) {
    const zep = zeroEndPoints.shift()!;
    const pluginInstances = getPlugin(zep.instance.name);
    sortedPoint.push(...pluginInstances);
    allLines = allLines.filter((l) => l[0] !== pluginInstances[0].instance.name);

    const restPoints = plugins.filter(
      (item) => !sortedPoint.find((sp) => sp.instance.name === item.instance.name),
    );
    zeroEndPoints = restPoints.filter((item) => !allLines.find((l) => l[1] === item.instance.name));
  }

  // if has ring, throw error
  if (allLines.length) {
    const restInRingPoints: Record<string, boolean> = {};
    for (const l of allLines) {
      restInRingPoints[l[0]] = true;
      restInRingPoints[l[1]] = true;
    }

    throw new Error(
      `${color.dim('[rsbuild:plugin]')} Plugins dependencies has loop: ${color.yellow(
        Object.keys(restInRingPoints).join(','),
      )}`,
    );
  }

  return sortedPoint;
};

export async function initPlugins({
  context,
  pluginManager,
}: {
  context: InternalContext;
  pluginManager: PluginManager;
}): Promise<void> {
  context.logger.debug('initializing plugins');

  let plugins = pluginManager.getAllPluginsWithMeta();
  plugins = sortPluginsByEnforce(plugins);
  plugins = sortPluginsByDependencies(plugins);

  const removedPlugins = new Set<string>();
  const removedEnvPlugins: Record<string, Set<string>> = {};

  for (const { environment, instance } of plugins) {
    if (!instance.remove) {
      continue;
    }
    if (environment) {
      removedEnvPlugins[environment] ??= new Set();
      for (const item of instance.remove) {
        removedEnvPlugins[environment].add(item);
      }
    } else {
      for (const item of instance.remove) {
        removedPlugins.add(item);
      }
    }
  }

  for (const { instance, environment } of plugins) {
    const { name, setup } = instance;
    if (removedPlugins.has(name) || (environment && removedEnvPlugins[environment]?.has(name))) {
      continue;
    }

    // Skip plugin if it has `apply` property and doesn't match the current
    // action type
    if (instance.apply && context.action) {
      if (isFunction(instance.apply)) {
        const result = instance.apply(context.originalConfig, {
          action: context.action,
        });
        if (!result) {
          continue;
        }
      } else {
        const applyMap = {
          build: 'build',
          dev: 'serve',
          preview: 'serve',
        } as const;

        const expected = applyMap[context.action];
        if (expected && instance.apply !== expected) {
          continue;
        }
      }
    }

    await setup(context.getPluginAPI!(environment));
  }

  context.logger.debug('plugins initialized');
}
