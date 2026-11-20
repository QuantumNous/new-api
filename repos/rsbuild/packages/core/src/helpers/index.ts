import deepmerge from 'deepmerge';
import { color } from 'rslog';
import { RspackChain } from 'rspack-chain';
import type {
  FilenameConfig,
  FilenameHash,
  NormalizedConfig,
  NormalizedEnvironmentConfig,
  RsbuildTarget,
  Rspack,
} from '../types';

export { require } from './vendors';

export { color, RspackChain };

export const getNodeEnv = (): string => process.env.NODE_ENV || '';
export const setNodeEnv = (env: string): void => {
  process.env.NODE_ENV = env;
};

export const isFunction = (func: unknown): func is (...args: any[]) => any =>
  typeof func === 'function';

export const isObject = (obj: unknown): obj is Record<string, any> =>
  Object.prototype.toString.call(obj) === '[object Object]';

// Cache Object.prototype reference for better performance in hot paths
const objectPrototype = Object.prototype;
const getProto = Object.getPrototypeOf;

export const isPlainObject = (obj: unknown): obj is Record<string, any> => {
  return obj !== null && typeof obj === 'object' && getProto(obj) === objectPrototype;
};

export const castArray = <T>(arr?: T | T[]): T[] => {
  if (arr === undefined) {
    return [];
  }
  return Array.isArray(arr) ? arr : [arr];
};

export const cloneDeep = <T>(value: T): T => {
  if (value === null || value === undefined) {
    return value;
  }
  return deepmerge<T>({}, value, {
    isMergeableObject: isPlainObject,
  });
};

const DEFAULT_FILENAME_HASH = 'contenthash:10';

const normalizeFilenameHash = (
  filenameHash: FilenameHash,
): {
  enable: boolean | 'always';
  format: string;
} => {
  if (typeof filenameHash === 'boolean') {
    return {
      enable: filenameHash,
      format: DEFAULT_FILENAME_HASH,
    };
  }

  if (typeof filenameHash === 'string') {
    return {
      enable: Boolean(filenameHash),
      format: filenameHash || DEFAULT_FILENAME_HASH,
    };
  }

  return {
    enable: filenameHash.enable ?? true,
    format: filenameHash.format ?? DEFAULT_FILENAME_HASH,
  };
};

export function getFilename(
  config: NormalizedConfig | NormalizedEnvironmentConfig,
  type: 'js',
  isProd: boolean,
  isServer?: boolean,
): Rspack.Filename;
export function getFilename(
  config: NormalizedConfig | NormalizedEnvironmentConfig,
  type: 'css',
  isProd: boolean,
): Rspack.CssFilename;
export function getFilename(
  config: NormalizedConfig | NormalizedEnvironmentConfig,
  type: 'html',
  isProd?: boolean,
): string;
export function getFilename(
  config: NormalizedConfig | NormalizedEnvironmentConfig,
  type: 'wasm',
  isProd: boolean,
): Rspack.WebassemblyModuleFilename;
export function getFilename(
  config: NormalizedConfig | NormalizedEnvironmentConfig,
  type: Exclude<keyof FilenameConfig, 'js' | 'css'>,
  isProd: boolean,
  isServer?: boolean,
): Rspack.AssetModuleFilename;
export function getFilename(
  config: NormalizedConfig | NormalizedEnvironmentConfig,
  type: keyof FilenameConfig,
  isProd?: boolean,
  isServer?: boolean,
) {
  const { filename, filenameHash } = config.output;
  const hashConfig = normalizeFilenameHash(filenameHash);
  const hashTemplate = `[${hashConfig.format}]`;

  const getHash = () => (hashConfig.enable !== false ? `.${hashTemplate}` : '');

  const getJsCssHash = (flag?: boolean) => {
    if (hashConfig.enable === 'always' || (hashConfig.enable === true && flag)) {
      return `.${hashTemplate}`;
    }
    return '';
  };

  switch (type) {
    case 'js':
      return filename.js ?? `[name]${getJsCssHash(isProd && !isServer)}.js`;
    case 'css':
      return filename.css ?? `[name]${getJsCssHash(isProd)}.css`;
    case 'svg':
      return filename.svg ?? `[name]${getHash()}.svg`;
    case 'font':
      return filename.font ?? `[name]${getHash()}[ext]`;
    case 'image':
      return filename.image ?? `[name]${getHash()}[ext]`;
    case 'media':
      return filename.media ?? `[name]${getHash()}[ext]`;
    case 'assets':
      return filename.assets ?? `[name]${getHash()}[ext]`;
    case 'wasm': {
      return filename.wasm ?? `${hashTemplate}.module.wasm`;
    }
    case 'html':
      if (filename.html) {
        return filename.html;
      }
      return config.html.outputStructure === 'flat' ? '[name].html' : '[name]/index.html';
    default:
      throw new Error(
        `${color.dim('[rsbuild:config]')} unknown key ${color.yellow(
          type,
        )} in ${color.yellow('output.filename')}`,
      );
  }
}

export function partition<T>(array: T[], predicate: (value: T) => boolean): [T[], T[]] {
  const truthy: T[] = [];
  const falsy: T[] = [];

  for (const value of array) {
    if (predicate(value)) {
      truthy.push(value);
    } else {
      falsy.push(value);
    }
  }

  return [truthy, falsy];
}

export const upperFirst = (str: string): string =>
  str ? str.charAt(0).toUpperCase() + str.slice(1) : '';

export const createVirtualModule = (content: string) =>
  `data:text/javascript,${encodeURIComponent(content)}`;

export function isWebTarget(target: RsbuildTarget | RsbuildTarget[]): boolean {
  const targets = castArray(target);
  return targets.includes('web') || targets.includes('web-worker');
}

export function pick<T, U extends keyof T>(obj: T, keys: readonly U[]): Pick<T, U> {
  const result = {} as Pick<T, U>;
  for (const key of keys) {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }
  return result;
}

export const camelCase = (input: string): string =>
  input.replace(/[-_](\w)/g, (_, c: string) => c.toUpperCase());

export const prettyTime = (seconds: number): string => {
  const format = (time: string, unit: 'm' | 's') => color.bold(`${time}${unit}`);

  if (seconds < 10) {
    const digits = seconds >= 0.01 ? 2 : 3;
    return format(seconds.toFixed(digits), 's');
  }

  if (seconds < 60) {
    return format(seconds.toFixed(1), 's');
  }

  const minutes = Math.floor(seconds / 60);
  const minutesLabel = format(minutes.toFixed(0), 'm');
  const remainingSeconds = seconds % 60;

  if (remainingSeconds === 0) {
    return minutesLabel;
  }

  const secondsLabel = format(remainingSeconds.toFixed(remainingSeconds % 1 === 0 ? 0 : 1), 's');

  return `${minutesLabel} ${secondsLabel}`;
};

/**
 * Check if running in a TTY context
 */
export const isTTY = (type: 'stdin' | 'stdout' = 'stdout'): boolean => {
  return (type === 'stdin' ? process.stdin.isTTY : process.stdout.isTTY) && !process.env.CI;
};

export async function hash(data: string): Promise<string> {
  const crypto = await import('node:crypto');
  // Available in Node.js v20.12.0
  // faster than `crypto.createHash()` when hashing a smaller amount of data (<= 5MB)
  if (crypto.hash) {
    return crypto.hash('sha256', data, 'hex').slice(0, 16);
  }
  const hasher = crypto.createHash('sha256');
  return hasher.update(data).digest('hex').slice(0, 16);
}

export const isRspackRuntimeModule = (identifier: string): boolean =>
  identifier.startsWith('webpack/runtime/');
