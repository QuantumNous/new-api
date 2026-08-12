import { realpathSync } from 'node:fs';
import path from 'node:path';

export interface PiPathMapper {
  /** The host-side mirror directory Pi reads/writes through the workspace VFS. */
  readonly hostWorkDir: string;
  /** The sandbox-side working directory where tools actually operate. */
  readonly sandboxWorkDir: string;
  /**
   * Translate a path the host sees (relative to `hostWorkDir`, or absolute
   * inside it, or already a sandbox path) to the canonical sandbox path. Throws
   * if the path would escape the workspace.
   */
  toSandboxPath(inputPath: string): string;
  /**
   * Translate a path for read-only tools. In addition to the workspace, this
   * allows explicitly configured sandbox roots such as `$HOME/.agents/skills`.
   */
  toReadableSandboxPath(inputPath: string): string;
  /** Translate any path to its POSIX-relative form under `sandboxWorkDir`. */
  toRelativePath(inputPath: string): string;
}

export interface PiReadablePathRoot {
  readonly sandboxDir: string;
}

export interface CreatePiPathMapperOptions {
  readonly hostWorkDir: string;
  readonly sandboxWorkDir: string;
  readonly readableRoots?: ReadonlyArray<PiReadablePathRoot>;
}

function isInsidePath(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return (
    relative === '' ||
    (!relative.startsWith('..') && !path.isAbsolute(relative))
  );
}

function isInsidePosixPath(parent: string, candidate: string): boolean {
  const relative = path.posix.relative(parent, candidate);
  return (
    relative === '' ||
    (!relative.startsWith('..') && !path.posix.isAbsolute(relative))
  );
}

function canonicalizeForContainment(inputPath: string): string {
  try {
    return realpathSync.native(inputPath);
  } catch {
    const parent = path.dirname(inputPath);
    if (parent === inputPath) {
      return inputPath;
    }
    return path.join(
      canonicalizeForContainment(parent),
      path.basename(inputPath),
    );
  }
}

export function createPiPathMapper(
  options: CreatePiPathMapperOptions,
): PiPathMapper {
  const normalizedHost = path.resolve(options.hostWorkDir);
  const normalizedSandbox = path.posix.normalize(options.sandboxWorkDir);
  const canonicalHost = canonicalizeForContainment(normalizedHost);
  const readableRoots =
    options.readableRoots?.map(root => ({
      sandboxDir: path.posix.normalize(root.sandboxDir),
    })) ?? [];

  const toWorkspaceSandboxPath = (inputPath: string): string => {
    if (path.posix.isAbsolute(inputPath)) {
      const normalizedInput = path.posix.normalize(inputPath);
      if (isInsidePosixPath(normalizedSandbox, normalizedInput)) {
        return normalizedInput;
      }
    }

    const resolvedHost = path.isAbsolute(inputPath)
      ? path.resolve(inputPath)
      : path.resolve(normalizedHost, inputPath);
    const canonicalResolvedHost = canonicalizeForContainment(resolvedHost);
    if (
      !isInsidePath(normalizedHost, resolvedHost) ||
      !isInsidePath(canonicalHost, canonicalResolvedHost)
    ) {
      throw new Error(`Pi path escapes the workspace: ${inputPath}`);
    }

    const relative = path
      .relative(normalizedHost, resolvedHost)
      .split(path.sep)
      .join('/');
    return relative
      ? path.posix.join(normalizedSandbox, relative)
      : normalizedSandbox;
  };

  return {
    hostWorkDir: normalizedHost,
    sandboxWorkDir: normalizedSandbox,
    toSandboxPath(inputPath: string) {
      return toWorkspaceSandboxPath(inputPath);
    },
    toReadableSandboxPath(inputPath: string) {
      if (path.posix.isAbsolute(inputPath)) {
        const normalizedInput = path.posix.normalize(inputPath);
        if (
          isInsidePosixPath(normalizedSandbox, normalizedInput) ||
          readableRoots.some(root =>
            isInsidePosixPath(root.sandboxDir, normalizedInput),
          )
        ) {
          return normalizedInput;
        }
      }

      return toWorkspaceSandboxPath(inputPath);
    },
    toRelativePath(inputPath: string) {
      const sandboxPath = path.posix.isAbsolute(inputPath)
        ? path.posix.normalize(inputPath)
        : path.posix.join(
            normalizedSandbox,
            inputPath.split(path.sep).join('/'),
          );
      const relative = path.posix.relative(normalizedSandbox, sandboxPath);
      return relative || '.';
    },
  };
}
