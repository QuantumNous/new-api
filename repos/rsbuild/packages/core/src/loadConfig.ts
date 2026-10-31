import {
  loadConfig as baseImpl,
  type LoadConfigOptions as BaseOptions,
  type LoadConfigResult as BaseResult,
} from '@rstackjs/load-config';
import { color, getNodeEnv, isObject } from './helpers';
import { defaultLogger } from './logger';
import type { RsbuildConfig } from './types';

export type { ConfigLoader } from '@rstackjs/load-config';

export type ConfigParams = {
  env: string;
  command: string;
  envMode?: string;
  meta?: Record<string, unknown>;
};

export type RsbuildConfigAsyncFn = (env: ConfigParams) => Promise<RsbuildConfig>;

export type RsbuildConfigSyncFn = (env: ConfigParams) => RsbuildConfig;

export type RsbuildConfigDefinition = RsbuildConfig | RsbuildConfigSyncFn | RsbuildConfigAsyncFn;

export type LoadConfigOptions = Pick<
  BaseOptions<[ConfigParams]>,
  'cwd' | 'path' | 'loader' | 'exportName' | 'configFileNames'
> & {
  /**
   * A custom meta object to be passed into the config function of `defineConfig`.
   */
  meta?: Record<string, unknown>;
  /**
   * The `envMode` passed into the config function of `defineConfig`.
   * @default process.env.NODE_ENV
   */
  envMode?: string;
  /**
   * The command passed to the config function.
   * @default process.argv[2]
   */
  command?: string;
};

export type LoadConfigResult<Config = RsbuildConfig> = Pick<
  BaseResult<Config>,
  'content' | 'filePath' | 'dependencies'
>;

/**
 * This function helps you to autocomplete configuration types.
 * It accepts a Rsbuild config object, or a function that returns a config.
 */
export function defineConfig(config: RsbuildConfig): RsbuildConfig;
export function defineConfig(config: RsbuildConfigSyncFn): RsbuildConfigSyncFn;
export function defineConfig(config: RsbuildConfigAsyncFn): RsbuildConfigAsyncFn;
export function defineConfig(config: RsbuildConfigDefinition): RsbuildConfigDefinition;
export function defineConfig(config: RsbuildConfigDefinition) {
  return config;
}

// Resolve the most commonly used config file types first to improve lookup performance.
const DEFAULT_CONFIG_FILE_NAMES = [
  'rsbuild.config.ts',
  'rsbuild.config.js',
  'rsbuild.config.mts',
  'rsbuild.config.mjs',
  'rsbuild.config.cts',
  'rsbuild.config.cjs',
];

export async function loadConfig<Config = RsbuildConfig>({
  cwd = process.cwd(),
  path,
  configFileNames = DEFAULT_CONFIG_FILE_NAMES,
  envMode,
  meta,
  loader = 'auto',
  command,
  exportName = 'default',
}: LoadConfigOptions = {}): Promise<LoadConfigResult<Config>> {
  const nodeEnv = getNodeEnv();
  const configParams: ConfigParams = {
    env: nodeEnv,
    command: command ?? process.argv[2],
    envMode: envMode || nodeEnv,
    meta,
  };

  const result = await baseImpl<Config, [ConfigParams]>({
    cwd,
    path,
    configFileNames,
    loader,
    exportName,
    configParams: [configParams],
    fresh: true,
  });

  if (!result.filePath) {
    defaultLogger.debug('no config file found.');
    return result as LoadConfigResult<Config>;
  }

  if (!isObject(result.content)) {
    throw new Error(
      `The config must be an object or a function that returns an object, get ${color.yellow(
        String(result.content),
      )}`,
    );
  }

  (result.content as RsbuildConfig)._privateMeta = {
    configFilePath: result.filePath,
  };

  defaultLogger.debug('configuration loaded from:', result.filePath);

  return result;
}
