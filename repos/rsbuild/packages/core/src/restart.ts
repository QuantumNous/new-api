import path from 'node:path';
import type { ChokidarOptions } from 'chokidar';
import { init } from './cli/init';
import { color, isTTY } from './helpers';
import type { Logger } from './logger';
import { createChokidar } from './server/watchFiles';
import type { RsbuildInstance } from './types';

type Cleaner = () => unknown;

let cleaners: Cleaner[] = [];

/**
 * Add a cleaner to handle side effects
 */
export const onBeforeRestartServer = (cleaner: Cleaner): void => {
  cleaners.push(cleaner);
};

const clearConsole = () => {
  if (isTTY() && !process.env.DEBUG) {
    process.stdout.write('\x1B[H\x1B[2J');
  }
};

const beforeRestart = async ({
  filePath,
  clear = true,
  id,
  logger,
}: {
  filePath?: string;
  clear?: boolean;
  id: string;
  logger: Logger;
}): Promise<void> => {
  if (clear) {
    clearConsole();
  }

  if (filePath) {
    const filename = path.basename(filePath);
    logger.info(`restarting ${id} as ${color.yellow(filename)} changed\n`);
  } else {
    logger.info(`restarting ${id}...\n`);
  }

  for (const cleaner of cleaners) {
    await cleaner();
  }
  cleaners = [];
};

export const restartDevServer = async ({
  filePath,
  clear = true,
  logger,
}: {
  filePath?: string;
  clear?: boolean;
  logger: Logger;
}): Promise<boolean> => {
  await beforeRestart({ filePath, clear, id: 'server', logger });

  const rsbuild = await init({ isRestart: true });

  // Skip the following logic if restart failed,
  // maybe user is editing config file and write some invalid config
  if (!rsbuild) {
    return false;
  }

  await rsbuild.startDevServer();
  return true;
};

const restartBuild = async ({
  filePath,
  clear = true,
  logger,
}: {
  filePath?: string;
  clear?: boolean;
  logger: Logger;
}): Promise<boolean> => {
  await beforeRestart({ filePath, clear, id: 'build', logger });

  const rsbuild = await init({ isRestart: true, isBuildWatch: true });

  // Skip the following logic if restart failed,
  // maybe user is editing config file and write some invalid config
  if (!rsbuild) {
    return false;
  }

  const buildInstance = await rsbuild.build({ watch: true });
  onBeforeRestartServer(buildInstance.close);
  return true;
};

export async function watchFilesForRestart({
  files,
  rsbuild,
  isBuildWatch,
  watchOptions,
}: {
  files: string[];
  rsbuild: RsbuildInstance;
  isBuildWatch: boolean;
  watchOptions?: ChokidarOptions;
}): Promise<void> {
  if (!files.length) {
    return;
  }

  const root = rsbuild.context.rootPath;
  const watcher = await createChokidar(files, root, {
    // do not trigger add for initial files
    ignoreInitial: true,
    // If watching fails due to read permissions, the errors will be suppressed silently.
    ignorePermissionErrors: true,
    ...watchOptions,
  });

  let restarting = false;

  const onChange = async (filePath: string) => {
    if (restarting) {
      return;
    }
    restarting = true;

    const restarted = isBuildWatch
      ? await restartBuild({ filePath, logger: rsbuild.logger })
      : await restartDevServer({ filePath, logger: rsbuild.logger });

    if (restarted) {
      await watcher.close();
    } else {
      rsbuild.logger.error(isBuildWatch ? 'Restart build failed.' : 'Restart server failed.');
    }

    restarting = false;
  };

  watcher.on('add', onChange);
  watcher.on('change', onChange);
  watcher.on('unlink', onChange);
}
