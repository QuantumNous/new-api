/**
 * Pi VFS — global Node `fs` monkey-patch that redirects reads/writes against a
 * mount point (the session's sandbox working directory, e.g.
 * `/vercel/sandbox/<harnessId>-<sessionId>/...`) to a real backing directory on
 * the host. The mount point is a sandbox path that does not exist on the host,
 * so the redirect never shadows real host files.
 *
 * The mapping is process-global because Pi's upstream runtime reads and
 * writes through the shared `fs` module. Concurrent mounts are supported as
 * long as each instance uses a distinct mount point (each session's sandbox
 * working directory is unique).
 *
 * Multi-instance invariants:
 * - Multiple `PiWorkspaceVfs` instances may stay mounted concurrently.
 * - Path routing uses longest-prefix matching, so mount points must not
 *   overlap.
 * - Extra `fs` patches stay installed while `mountedRoots.size > 0` and are
 *   restored only after the final unmount.
 * - Mount and unmount remain synchronous, so Node's single-threaded execution
 *   preserves patch/install ordering.
 *
 * Supported logical-path APIs:
 * - Sync: `existsSync`, `readFileSync`, `writeFileSync`, `mkdirSync`,
 *   `readdirSync`, `renameSync`, `rmSync`, `openSync`, `statSync`,
 *   `realpathSync` (+ `.native`).
 * - Callback: `mkdir`, `realpath`, `stat`, `rmdir`, `utimes`, `writeFile`.
 * - Promises: `fs.promises.mkdir`, `fs.promises.readFile`,
 *   `fs.promises.writeFile`.
 *
 * Anything else is intentionally unsupported. If Pi starts using additional
 * `fs` APIs against logical roots, those call sites must be added here
 * deliberately with tests.
 */

import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import path from 'node:path';

type MountedRoot = {
  backingRoot: string;
  mountPoint: string;
};

type WrappedRealpathSync = typeof fs.realpathSync & {
  native?: typeof fs.realpathSync.native;
};

type Mutable<T> = {
  -readonly [K in keyof T]: T[K];
};

const mountedRoots = new Map<string, MountedRoot>();
const mutableFs = fs as Mutable<typeof fs>;
const mutableFsPromises = fs.promises as Mutable<typeof fs.promises>;

const originalFsSyncMethods = {
  existsSync: fs.existsSync,
  mkdirSync: fs.mkdirSync,
  openSync: fs.openSync,
  readFileSync: fs.readFileSync,
  readdirSync: fs.readdirSync,
  realpathSync: fs.realpathSync,
  renameSync: fs.renameSync,
  rmSync: fs.rmSync,
  statSync: fs.statSync,
  writeFileSync: fs.writeFileSync,
};

const originalFsCallbackMethods = {
  mkdir: fs.mkdir,
  realpath: fs.realpath,
  rmdir: fs.rmdir,
  stat: fs.stat,
  utimes: fs.utimes,
  writeFile: fs.writeFile,
};

const originalFsPromises = {
  mkdir: fs.promises.mkdir.bind(fs.promises),
  readFile: fs.promises.readFile.bind(fs.promises),
  writeFile: fs.promises.writeFile.bind(fs.promises),
};

function isInsidePath(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return (
    relative === '' ||
    (!relative.startsWith('..') && !path.isAbsolute(relative))
  );
}

function resolveAbsolutePath(inputPath: string): string {
  return path.isAbsolute(inputPath)
    ? path.normalize(inputPath)
    : path.resolve(inputPath);
}

function findMountedRoot(inputPath: string): MountedRoot | undefined {
  const resolvedPath = resolveAbsolutePath(inputPath);
  let bestMatch: MountedRoot | undefined;

  for (const mountedRoot of mountedRoots.values()) {
    if (!isInsidePath(mountedRoot.mountPoint, resolvedPath)) {
      continue;
    }
    if (
      !bestMatch ||
      mountedRoot.mountPoint.length > bestMatch.mountPoint.length
    ) {
      bestMatch = mountedRoot;
    }
  }

  return bestMatch;
}

function mapToBackingPath(inputPath: string): string | null {
  const mountedRoot = findMountedRoot(inputPath);
  if (!mountedRoot) {
    return null;
  }

  const resolvedPath = resolveAbsolutePath(inputPath);
  const relativePath = path.relative(mountedRoot.mountPoint, resolvedPath);
  return relativePath
    ? path.join(mountedRoot.backingRoot, relativePath)
    : mountedRoot.backingRoot;
}

function mapRealpathResult(inputPath: string, result: string): string {
  const mountedRoot = findMountedRoot(inputPath);
  if (!mountedRoot) {
    return result;
  }

  let normalizedBackingRoot = path.resolve(mountedRoot.backingRoot);
  try {
    const realpath =
      originalFsSyncMethods.realpathSync.native ??
      originalFsSyncMethods.realpathSync;
    normalizedBackingRoot = path.resolve(realpath(mountedRoot.backingRoot));
  } catch {
    // Fall back to the configured backing root when canonicalization fails.
  }

  const normalizedResult = path.resolve(result);
  if (!isInsidePath(normalizedBackingRoot, normalizedResult)) {
    return result;
  }

  const relativePath = path.relative(normalizedBackingRoot, normalizedResult);
  return relativePath
    ? path.join(mountedRoot.mountPoint, relativePath)
    : mountedRoot.mountPoint;
}

function mapRenamePaths(
  sourcePath: string,
  destinationPath: string,
): [string, string] | null {
  const sourceRoot = findMountedRoot(sourcePath);
  const destinationRoot = findMountedRoot(destinationPath);

  if (!sourceRoot && !destinationRoot) {
    return null;
  }

  if (
    !sourceRoot ||
    !destinationRoot ||
    sourceRoot.mountPoint !== destinationRoot.mountPoint
  ) {
    throw new Error(
      'Pi logical VFS paths cannot rename across mount boundaries',
    );
  }

  return [
    mapToBackingPath(sourcePath) ?? sourcePath,
    mapToBackingPath(destinationPath) ?? destinationPath,
  ];
}

function wrapSinglePathSync<Fn extends (...args: never[]) => unknown>(
  original: Fn,
  options: {
    mapResult?: (inputPath: string, result: ReturnType<Fn>) => ReturnType<Fn>;
  } = {},
): Fn {
  return ((...args: Parameters<Fn>) => {
    const [inputPath] = args;
    if (typeof inputPath === 'string') {
      const mappedPath = mapToBackingPath(inputPath);
      if (mappedPath) {
        const result = original(
          ...([mappedPath, ...args.slice(1)] as Parameters<Fn>),
        ) as ReturnType<Fn>;
        return options.mapResult
          ? options.mapResult(inputPath, result)
          : result;
      }
    }
    return original(...args);
  }) as Fn;
}

function wrapRenameSync<Fn extends (...args: never[]) => unknown>(
  original: Fn,
): Fn {
  return ((...args: Parameters<Fn>) => {
    const [sourcePath, destinationPath] = args;
    if (typeof sourcePath === 'string' && typeof destinationPath === 'string') {
      const mappedPaths = mapRenamePaths(sourcePath, destinationPath);
      if (mappedPaths) {
        return original(
          ...([
            mappedPaths[0],
            mappedPaths[1],
            ...args.slice(2),
          ] as Parameters<Fn>),
        );
      }
    }
    return original(...args);
  }) as Fn;
}

function wrapSinglePathCallback<Fn extends (...args: never[]) => unknown>(
  original: Fn,
  options: {
    mapCallbackResult?: (inputPath: string, result: unknown) => unknown;
  } = {},
): Fn {
  return ((...args: Parameters<Fn>) => {
    const [inputPath] = args;
    if (typeof inputPath === 'string') {
      const mappedPath = mapToBackingPath(inputPath);
      if (mappedPath) {
        const nextArgs = [mappedPath, ...args.slice(1)] as unknown[];
        const maybeCallback = nextArgs.at(-1);
        if (options.mapCallbackResult && typeof maybeCallback === 'function') {
          nextArgs[nextArgs.length - 1] = (
            error: NodeJS.ErrnoException | null,
            result: unknown,
            ...rest: unknown[]
          ) => {
            const mappedResult = error
              ? result
              : options.mapCallbackResult?.(inputPath, result);
            (maybeCallback as (...callbackArgs: unknown[]) => void)(
              error,
              mappedResult,
              ...rest,
            );
          };
        }
        return original(...(nextArgs as Parameters<Fn>));
      }
    }
    return original(...args);
  }) as Fn;
}

function wrapSinglePathPromise<
  Fn extends (...args: never[]) => Promise<unknown>,
>(original: Fn): Fn {
  return (async (...args: Parameters<Fn>) => {
    const [inputPath] = args;
    if (typeof inputPath === 'string') {
      const mappedPath = mapToBackingPath(inputPath);
      if (mappedPath) {
        return await original(
          ...([mappedPath, ...args.slice(1)] as Parameters<Fn>),
        );
      }
    }
    return await original(...args);
  }) as Fn;
}

function createWrappedRealpathSync(): WrappedRealpathSync {
  const wrapped = wrapSinglePathSync(originalFsSyncMethods.realpathSync, {
    mapResult: (inputPath, result) =>
      typeof result === 'string'
        ? mapRealpathResult(inputPath, result)
        : result,
  }) as WrappedRealpathSync;

  if (originalFsSyncMethods.realpathSync.native) {
    wrapped.native = wrapSinglePathSync(
      originalFsSyncMethods.realpathSync.native,
      {
        mapResult: (inputPath, result) =>
          typeof result === 'string'
            ? mapRealpathResult(inputPath, result)
            : result,
      },
    ) as typeof fs.realpathSync.native;
  }

  return wrapped;
}

const wrappedFsSyncMethods = {
  existsSync: wrapSinglePathSync(originalFsSyncMethods.existsSync),
  mkdirSync: wrapSinglePathSync(originalFsSyncMethods.mkdirSync),
  openSync: wrapSinglePathSync(originalFsSyncMethods.openSync),
  readFileSync: wrapSinglePathSync(originalFsSyncMethods.readFileSync),
  readdirSync: wrapSinglePathSync(originalFsSyncMethods.readdirSync),
  realpathSync: createWrappedRealpathSync(),
  renameSync: wrapRenameSync(originalFsSyncMethods.renameSync),
  rmSync: wrapSinglePathSync(originalFsSyncMethods.rmSync),
  statSync: wrapSinglePathSync(originalFsSyncMethods.statSync),
  writeFileSync: wrapSinglePathSync(originalFsSyncMethods.writeFileSync),
};

const wrappedFsCallbackMethods = {
  mkdir: wrapSinglePathCallback(originalFsCallbackMethods.mkdir),
  realpath: wrapSinglePathCallback(originalFsCallbackMethods.realpath, {
    mapCallbackResult: (inputPath, result) =>
      typeof result === 'string'
        ? mapRealpathResult(inputPath, result)
        : result,
  }),
  rmdir: wrapSinglePathCallback(originalFsCallbackMethods.rmdir),
  stat: wrapSinglePathCallback(originalFsCallbackMethods.stat),
  utimes: wrapSinglePathCallback(originalFsCallbackMethods.utimes),
  writeFile: wrapSinglePathCallback(originalFsCallbackMethods.writeFile),
};

const wrappedFsPromises = {
  mkdir: wrapSinglePathPromise(originalFsPromises.mkdir),
  readFile: wrapSinglePathPromise(originalFsPromises.readFile),
  writeFile: wrapSinglePathPromise(originalFsPromises.writeFile),
};

function areExtraFsPatchesInstalled(): boolean {
  return mutableFs.existsSync === wrappedFsSyncMethods.existsSync;
}

function installExtraFsPatches() {
  if (areExtraFsPatchesInstalled()) return;

  mutableFs.existsSync = wrappedFsSyncMethods.existsSync;
  mutableFs.mkdirSync = wrappedFsSyncMethods.mkdirSync;
  mutableFs.openSync = wrappedFsSyncMethods.openSync;
  mutableFs.readFileSync = wrappedFsSyncMethods.readFileSync;
  mutableFs.readdirSync = wrappedFsSyncMethods.readdirSync;
  mutableFs.realpathSync = wrappedFsSyncMethods.realpathSync;
  mutableFs.renameSync = wrappedFsSyncMethods.renameSync;
  mutableFs.rmSync = wrappedFsSyncMethods.rmSync;
  mutableFs.statSync = wrappedFsSyncMethods.statSync;
  mutableFs.writeFileSync = wrappedFsSyncMethods.writeFileSync;

  mutableFs.mkdir = wrappedFsCallbackMethods.mkdir;
  mutableFs.realpath = wrappedFsCallbackMethods.realpath;
  mutableFs.rmdir = wrappedFsCallbackMethods.rmdir;
  mutableFs.stat = wrappedFsCallbackMethods.stat;
  mutableFs.utimes = wrappedFsCallbackMethods.utimes;
  mutableFs.writeFile = wrappedFsCallbackMethods.writeFile;

  mutableFsPromises.mkdir = wrappedFsPromises.mkdir;
  mutableFsPromises.readFile = wrappedFsPromises.readFile;
  mutableFsPromises.writeFile = wrappedFsPromises.writeFile;

  syncBuiltinESMExports();
}

function restoreExtraFsPatches() {
  if (!areExtraFsPatchesInstalled()) return;

  mutableFs.existsSync = originalFsSyncMethods.existsSync;
  mutableFs.mkdirSync = originalFsSyncMethods.mkdirSync;
  mutableFs.openSync = originalFsSyncMethods.openSync;
  mutableFs.readFileSync = originalFsSyncMethods.readFileSync;
  mutableFs.readdirSync = originalFsSyncMethods.readdirSync;
  mutableFs.realpathSync = originalFsSyncMethods.realpathSync;
  mutableFs.renameSync = originalFsSyncMethods.renameSync;
  mutableFs.rmSync = originalFsSyncMethods.rmSync;
  mutableFs.statSync = originalFsSyncMethods.statSync;
  mutableFs.writeFileSync = originalFsSyncMethods.writeFileSync;

  mutableFs.mkdir = originalFsCallbackMethods.mkdir;
  mutableFs.realpath = originalFsCallbackMethods.realpath;
  mutableFs.rmdir = originalFsCallbackMethods.rmdir;
  mutableFs.stat = originalFsCallbackMethods.stat;
  mutableFs.utimes = originalFsCallbackMethods.utimes;
  mutableFs.writeFile = originalFsCallbackMethods.writeFile;

  mutableFsPromises.mkdir = originalFsPromises.mkdir;
  mutableFsPromises.readFile = originalFsPromises.readFile;
  mutableFsPromises.writeFile = originalFsPromises.writeFile;

  syncBuiltinESMExports();
}

export class PiWorkspaceVfs {
  private backingRoot: string | null = null;
  private mountPoint: string | null = null;

  private disposeMount(): void {
    if (this.mountPoint) {
      mountedRoots.delete(this.mountPoint);
    }
    this.backingRoot = null;
    this.mountPoint = null;
  }

  mount(backingRoot: string, mountPoint: string): void {
    if (this.backingRoot === backingRoot && this.mountPoint === mountPoint) {
      return;
    }

    const resolvedBackingRoot = path.resolve(backingRoot);
    const resolvedMountPoint = path.resolve(mountPoint);
    if (this.mountPoint) {
      this.disposeMount();
    }

    mountedRoots.set(resolvedMountPoint, {
      backingRoot: resolvedBackingRoot,
      mountPoint: resolvedMountPoint,
    });
    installExtraFsPatches();

    this.backingRoot = resolvedBackingRoot;
    this.mountPoint = resolvedMountPoint;
  }

  unmount(): void {
    this.disposeMount();

    if (mountedRoots.size === 0) {
      restoreExtraFsPatches();
    }
  }
}
