import type { FSWatcher } from 'chokidar';
import { castArray } from '../helpers';
import type {
  ChokidarOptions,
  DevConfig,
  NormalizedConfig,
  NormalizedServerConfig,
  WatchFiles,
} from '../types';
import type { BuildManager } from './buildManager';

type WatchFilesOptions = {
  root: string;
  config: NormalizedConfig;
  buildManager?: BuildManager;
};

export type WatchFilesResult = {
  close(): Promise<void>;
};

export async function setupWatchFiles(
  options: WatchFilesOptions,
): Promise<WatchFilesResult | undefined> {
  const { config, root, buildManager } = options;

  const { hmr, liveReload } = config.dev;
  if ((!hmr && !liveReload) || !buildManager) {
    return;
  }

  const closeDevFilesWatcher = await watchDevFiles(config.dev, buildManager, root);
  const serverFilesWatcher = await watchServerFiles(config.server, buildManager, root);

  return {
    async close() {
      await Promise.all([closeDevFilesWatcher?.(), serverFilesWatcher?.close()]);
    },
  };
}

async function watchDevFiles(devConfig: DevConfig, buildManager: BuildManager, root: string) {
  const { watchFiles } = devConfig;
  if (!watchFiles) {
    return;
  }

  const watchers: FSWatcher[] = [];

  for (const { paths, options, type } of castArray(watchFiles)) {
    const watchOptions = prepareWatchOptions(paths, options, type);
    const watcher = await startWatchFiles(watchOptions, buildManager, root);
    if (watcher) {
      watchers.push(watcher);
    }
  }

  return async () => {
    for (const watcher of watchers) {
      await watcher.close();
    }
  };
}

function watchServerFiles(
  { publicDir }: NormalizedServerConfig,
  buildManager: BuildManager,
  root: string,
) {
  if (!publicDir.length) {
    return;
  }

  const watchPaths = publicDir.filter((item) => item.watch).map((item) => item.name);

  if (!watchPaths.length) {
    return;
  }

  const watchOptions = prepareWatchOptions(watchPaths);
  return startWatchFiles(watchOptions, buildManager, root);
}

function prepareWatchOptions(
  paths: string | string[],
  options: ChokidarOptions = {},
  type?: WatchFiles['type'],
) {
  return {
    paths: typeof paths === 'string' ? [paths] : paths,
    options,
    type,
  };
}

const GLOB_REGEX = /[*?{}[\]()!+|]/;
/**
 * A simple glob pattern checker.
 * This can help us to avoid unnecessary tinyglobby import and call.
 */
const isGlob = (str: string): boolean => GLOB_REGEX.test(str);

export async function createChokidar(
  pathOrGlobs: string[],
  root: string,
  options: ChokidarOptions,
): Promise<FSWatcher> {
  const { default: chokidar } = await import(/* rspackChunkName: "chokidar" */ 'chokidar');

  const watchFiles = new Set<string>();

  const globPatterns = pathOrGlobs.filter((pathOrGlob) => {
    if (isGlob(pathOrGlob)) {
      return true;
    }
    watchFiles.add(pathOrGlob);
    return false;
  });

  if (globPatterns.length) {
    const { glob } = await import(/* rspackChunkName: "tinyglobby" */ 'tinyglobby');
    // interop default to make both CJS and ESM work
    const files = await glob(globPatterns, {
      cwd: root,
      absolute: true,
    });
    for (const file of files) {
      watchFiles.add(file);
    }
  }

  return chokidar.watch(Array.from(watchFiles), options);
}

async function startWatchFiles(
  { paths, options, type = 'reload-page' }: ReturnType<typeof prepareWatchOptions>,
  buildManager: BuildManager,
  root: string,
) {
  if (type !== 'reload-page') {
    return;
  }

  const watcher = await createChokidar(paths, root, options);

  watcher.on('change', () => {
    buildManager.socketServer.sendMessage({
      type: 'full-reload',
    });
  });

  return watcher;
}
