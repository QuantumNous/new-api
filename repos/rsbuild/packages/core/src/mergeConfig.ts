import { cloneDeep, isPlainObject } from './helpers';
import type { RsbuildConfig } from './types';

const OVERRIDE_PATHS = new Set([
  'performance.removeConsole',
  'output.inlineScripts',
  'output.inlineStyles',
  'output.cssModules.auto',
  'output.manifest.filter',
  'output.manifest.generate',
  'output.overrideBrowserslist',
  'performance.printFileSize.exclude',
  'performance.printFileSize.include',
  'performance.printFileSize.total',
  'server.open',
  'server.compress.filter',
  'server.printUrls',
  'resolve.extensions',
  'resolve.conditionNames',
  'resolve.mainFields',
  'dev.writeToDisk',
  'dev.client.overlay.errors',
  'dev.client.overlay.runtime',
  'provider',
  'customLogger',
]);

/**
 * When merging configs, some properties prefer `override` over `merge to array`
 */
const isOverridePath = (key: string) => {
  // ignore environments name prefix, such as `environments.web`
  if (key.startsWith('environments.')) {
    const realKey = key.split('.').slice(2).join('.');
    return OVERRIDE_PATHS.has(realKey);
  }
  return (
    OVERRIDE_PATHS.has(key) ||
    // output.filename.* supports function but we should not merge them as array
    key.startsWith('output.filename.')
  );
};

const merge = (x: unknown, y: unknown, path = ''): unknown => {
  // force some keys to override
  if (isOverridePath(path)) {
    return y ?? x;
  }

  // ignore undefined property
  if (x === undefined) {
    return isPlainObject(y) ? cloneDeep(y) : y;
  }
  if (y === undefined) {
    return isPlainObject(x) ? cloneDeep(x) : x;
  }

  const typeX = typeof x;
  const typeY = typeof y;

  // no need to merge boolean with object or function, such as `tools.htmlPlugin`
  if (typeX === 'boolean' || typeY === 'boolean') {
    return y;
  }

  // combine array
  const isArrayX = Array.isArray(x);
  const isArrayY = Array.isArray(y);
  if (isArrayX && isArrayY) {
    return x.concat(y);
  } else if (isArrayX) {
    return [...x, y];
  } else if (isArrayY) {
    return [x, ...y];
  }

  // convert function to chained function
  if (typeX === 'function' || typeY === 'function') {
    return [x, y];
  }

  if (!isPlainObject(x) || !isPlainObject(y)) {
    return y;
  }

  const merged: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(x), ...Object.keys(y)]);

  for (const key of keys) {
    const childPath = path ? `${path}.${key}` : key;
    merged[key] = merge(x[key], y[key], childPath);
  }

  return merged;
};

/**
 * Preprocess config before merging to convert the raw config into a consistent
 * object-based structure. This ensures some properties can be merged as expected.
 */
const normalizeConfigStructure = <T = RsbuildConfig>(config: T): T => {
  let { dev, output } = config as RsbuildConfig;
  const normalizedConfig = { ...config } as RsbuildConfig;

  if (output) {
    output = { ...output };

    if (Array.isArray(output.copy)) {
      output.copy = { patterns: output.copy };
    }
    if (typeof output.distPath === 'string') {
      output.distPath = { root: output.distPath };
    }

    normalizedConfig.output = output;
  }

  if (dev) {
    dev = { ...dev };

    if (dev.watchFiles && !Array.isArray(dev.watchFiles)) {
      dev.watchFiles = [dev.watchFiles];
    }

    normalizedConfig.dev = dev;
  }

  return normalizedConfig as T;
};

/**
 * Deeply merges multiple Rsbuild configuration objects.
 *
 * This function returns a new merged configuration object and does not modify
 * the input configuration objects.
 */
export const mergeRsbuildConfig = <T = RsbuildConfig>(...originalConfigs: (T | undefined)[]): T => {
  const configs = originalConfigs
    .filter((config) => config !== undefined)
    .map(normalizeConfigStructure);

  // In most cases there will be two configs so we perform this check first
  if (configs.length === 2) {
    return merge(configs[0], configs[1]) as T;
  }
  if (configs.length === 0) {
    return {} as T;
  }
  return configs.reduce((result, config) => merge(result, config) as T, {} as T);
};
