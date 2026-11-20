import { isAbsolute, normalize, sep } from 'node:path';
import type { PluginOptions as BabelPluginOptions } from '@babel/core';
import type { ChainIdentifier, RspackChain } from '@rsbuild/core';
import { reduceConfigsWithContext } from 'reduce-configs';
import type {
  BabelConfigUtils,
  BabelLoaderOptions,
  BabelPlugin,
  BabelTransformOptions,
  PluginBabelOptions,
  PresetEnvOptions,
  PresetReactOptions,
} from './types.js';

export const BABEL_JS_RULE = 'babel-js';
const BABEL_JS_RULE_REGEXP = /^babel-js(?:-\d+)?$/;

export const getBabelRuleId = (chain: RspackChain): string => {
  let id = BABEL_JS_RULE;
  let index = 0;
  while (chain.module.rules.has(id)) {
    id = `${BABEL_JS_RULE}-${++index}`;
  }
  return id;
};

const isBabelRuleId = (id: string) => BABEL_JS_RULE_REGEXP.test(id);

const getBabelRules = (chain: RspackChain) => {
  const ruleIds = Object.keys(chain.module.rules.entries()).filter(isBabelRuleId);

  return ruleIds.map((id) => chain.module.rules.get(id));
};

export const castArray = <T>(arr?: T | T[]): T[] => {
  if (arr === undefined) {
    return [];
  }
  return Array.isArray(arr) ? arr : [arr];
};

const normalizeToPosixPath = (p: string | undefined) =>
  normalize(p || '')
    .replace(/\\/g, '/')
    .replace(/^([a-zA-Z]+):/, (_, m: string) => `/${m.toLowerCase()}`);

// compatible with Windows path
const formatPath = (originPath: string) => {
  if (isAbsolute(originPath)) {
    return originPath.split(sep).join('/');
  }
  return originPath;
};

const getPluginItemName = (item: BabelPlugin) => {
  if (typeof item === 'string') {
    return formatPath(item);
  }
  if (Array.isArray(item) && typeof item[0] === 'string') {
    return formatPath(item[0]);
  }
  return null;
};

const addPlugins = (plugins: BabelPlugin[], config: BabelTransformOptions) => {
  if (config.plugins) {
    config.plugins.push(...plugins);
  } else {
    config.plugins = plugins;
  }
};

const addPresets = (presets: BabelPlugin[], config: BabelTransformOptions) => {
  if (config.presets) {
    config.presets.push(...presets);
  } else {
    config.presets = presets;
  }
};

const removePlugins = (plugins: string | string[], config: BabelTransformOptions) => {
  if (!config.plugins) {
    return;
  }

  const removeList = castArray(plugins);

  config.plugins = config.plugins.filter((item: BabelPlugin) => {
    const name = getPluginItemName(item);
    if (name) {
      return !removeList.find((removeItem) => name.includes(removeItem));
    }
    return true;
  });
};

const removePresets = (presets: string | string[], config: BabelTransformOptions) => {
  if (!config.presets) {
    return;
  }

  const removeList = castArray(presets);

  config.presets = config.presets.filter((item: BabelPlugin) => {
    const name = getPluginItemName(item);
    if (name) {
      return !removeList.find((removeItem) => name.includes(removeItem));
    }
    return true;
  });
};

const modifyPresetOptions = <T>(presetName: string, options: T, presets: BabelPlugin[] = []) => {
  presets.forEach((preset: BabelPlugin, index) => {
    // 1. ['@babel/preset-env', ...]
    if (Array.isArray(preset)) {
      if (typeof preset[0] === 'string' && normalizeToPosixPath(preset[0]).includes(presetName)) {
        preset[1] = {
          ...(preset[1] || {}),
          ...options,
          // `options` is specific to different presets
        } as BabelPluginOptions;
      }
    } else if (typeof preset === 'string' && normalizeToPosixPath(preset).includes(presetName)) {
      // 2. '@babel/preset-env'
      presets[index] = [preset, options];
    }
  });
};

export const getBabelUtils = (config: BabelTransformOptions): BabelConfigUtils => {
  const noop = () => {};

  return {
    addPlugins: (plugins: BabelPlugin[]) => {
      addPlugins(plugins, config);
    },
    addPresets: (presets: BabelPlugin[]) => {
      addPresets(presets, config);
    },
    removePlugins: (plugins: string | string[]) => {
      removePlugins(plugins, config);
    },
    removePresets: (presets: string | string[]) => {
      removePresets(presets, config);
    },
    // `addIncludes` and `addExcludes` are noop functions by default,
    // It can be overridden by `extraBabelUtils`.
    addIncludes: noop,
    addExcludes: noop,
    // Compat `presetEnvOptions` and `presetReactOptions` in Modern.js
    modifyPresetEnvOptions: (options: PresetEnvOptions) => {
      modifyPresetOptions('@babel/preset-env', options, config.presets || []);
    },
    modifyPresetReactOptions: (options: PresetReactOptions) => {
      modifyPresetOptions('@babel/preset-react', options, config.presets || []);
    },
  };
};

export const applyUserBabelConfig = (
  defaultOptions: BabelLoaderOptions,
  userBabelConfig?: PluginBabelOptions['babelLoaderOptions'],
  extraBabelUtils?: Partial<BabelConfigUtils>,
): BabelLoaderOptions => {
  if (userBabelConfig) {
    const babelUtils = {
      ...getBabelUtils(defaultOptions),
      ...extraBabelUtils,
    } as BabelConfigUtils;

    return reduceConfigsWithContext({
      initial: defaultOptions,
      config: userBabelConfig,
      ctx: babelUtils,
    });
  }

  return defaultOptions;
};

export const modifyBabelLoaderOptions = ({
  chain,
  CHAIN_ID,
  modifier,
}: {
  chain: RspackChain;
  CHAIN_ID: ChainIdentifier;
  modifier: (config: BabelTransformOptions) => BabelTransformOptions;
}): void => {
  const rules = [
    chain.module.rules.get(CHAIN_ID.RULE.JS).oneOfs.get(CHAIN_ID.ONE_OF.JS_MAIN),
    chain.module.rules.get(CHAIN_ID.RULE.JS_DATA_URI),
    ...getBabelRules(chain),
  ].filter(Boolean);

  for (const rule of rules) {
    if (rule.uses.has(CHAIN_ID.USE.BABEL)) {
      rule.use(CHAIN_ID.USE.BABEL).tap(modifier);
    }
  }
};
