import path from 'node:path';
import { createRsbuild } from '../createRsbuild';
import { castArray } from '../helpers';
import { ensureAbsolutePath } from '../helpers/path';
import { loadConfig as baseLoadConfig } from '../loadConfig';
import { defaultLogger } from '../logger';
import { watchFilesForRestart } from '../restart';
import type { RsbuildInstance } from '../types';
import type { CommonOptions } from './commands';

export type CommandName = 'dev' | 'build' | 'preview' | 'inspect';

const cliState: {
  options: CommonOptions;
  command?: CommandName;
} = {
  options: {} as CommonOptions,
};

export const initCliAction = (command: CommandName, options: CommonOptions): void => {
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV =
      command === 'build' || command === 'preview' ? 'production' : 'development';
  }

  // Build multiple environments can be shortened to: --environment name1,name2
  if (options.environment?.some((env) => env.includes(','))) {
    options.environment = options.environment.flatMap((env) => env.split(','));
  }

  cliState.command = command;
  cliState.options = options;
};

const getEnvDir = (cwd: string, envDir?: string) => {
  if (envDir) {
    return path.isAbsolute(envDir) ? envDir : path.join(cwd, envDir);
  }
  return cwd;
};

const loadConfig = async (root: string) => {
  const { options, command } = cliState;
  const {
    content: config,
    filePath,
    dependencies,
  } = await baseLoadConfig({
    cwd: root,
    path: options.config,
    envMode: options.envMode,
    loader: options.configLoader,
    command,
  });

  config.dev ||= {};
  config.source ||= {};
  config.server ||= {};

  if (options.base) {
    config.server.base = options.base;
  }

  if (options.root) {
    config.root = root;
  }

  if (options.mode) {
    config.mode = options.mode;
  }

  if (options.logLevel) {
    config.logLevel = options.logLevel;
  }

  if (options.open && !config.server?.open) {
    config.server.open = options.open;
  }

  if (options.host !== undefined) {
    config.server.host = options.host;
  }

  if (options.port) {
    config.server.port = options.port;
  }

  if (options.strictPort !== undefined) {
    config.server.strictPort = options.strictPort;
  }

  if (options.distPath !== undefined) {
    config.output ||= {};

    const { distPath } = config.output;
    config.output.distPath =
      distPath && typeof distPath === 'object'
        ? { ...distPath, root: options.distPath }
        : { root: options.distPath };
  }

  if (options.sourceMap !== undefined) {
    const sourceMap = options.sourceMap as unknown;

    if (typeof sourceMap !== 'boolean') {
      throw new Error('The "--source-map" option only accepts a boolean value.');
    }

    config.output ||= {};
    config.output.sourceMap = sourceMap;
  }

  // enable CLI shortcuts by default when using Rsbuild CLI
  if (config.dev.cliShortcuts === undefined) {
    config.dev.cliShortcuts = true;
  }

  // watch the config file
  if (filePath) {
    config.dev.watchFiles = [
      ...(config.dev.watchFiles ? castArray(config.dev.watchFiles) : []),
      {
        paths: [filePath, ...dependencies],
        type: 'reload-server',
      },
    ];
  }

  return config;
};

export async function init({
  isRestart,
  isBuildWatch = false,
}: {
  isRestart?: boolean;
  isBuildWatch?: boolean;
} = {}): Promise<RsbuildInstance | undefined> {
  let logger = defaultLogger;
  const { options } = cliState;

  try {
    const cwd = process.cwd();
    const root = options.root ? ensureAbsolutePath(cwd, options.root) : cwd;

    const rsbuild = await createRsbuild({
      cwd: root,
      config: () => loadConfig(root),
      environment: options.environment,
      loadEnv:
        options.env === false
          ? false
          : {
              cwd: getEnvDir(root, options.envDir),
              mode: options.envMode,
            },
    });
    logger = rsbuild.logger;

    rsbuild.onBeforeCreateCompiler(() => {
      // Skip watching files when not in dev mode or not in build watch mode
      if (rsbuild.context.action !== 'dev' && !isBuildWatch) {
        return;
      }

      const files: string[] = [];
      const config = rsbuild.getNormalizedConfig();

      if (config.dev.watchFiles) {
        for (const watchConfig of config.dev.watchFiles) {
          if (watchConfig.type !== 'reload-server') {
            continue;
          }

          const paths = castArray(watchConfig.paths);
          if (watchConfig.options) {
            watchFilesForRestart({
              files: paths,
              rsbuild,
              isBuildWatch,
              watchOptions: watchConfig.options,
            });
          } else {
            files.push(...paths);
          }
        }
      }

      watchFilesForRestart({
        files,
        rsbuild,
        isBuildWatch,
      });
    });

    return rsbuild;
  } catch (err) {
    if (isRestart) {
      logger.error(err);
    } else {
      throw err;
    }
  }
}
