import fs from 'node:fs';
import path from 'node:path';
import type { Logger } from '../logger';
import type { Rspack } from '../types';
import { toPosixPath } from './path';

export const isFileSync = (filePath: string): boolean | undefined => {
  try {
    return fs.statSync(filePath, { throwIfNoEntry: false })?.isFile();
  } catch {
    return false;
  }
};

export function isEmptyDir(path: string): boolean {
  const files = fs.readdirSync(path);
  return files.length === 0 || (files.length === 1 && files[0] === '.git');
}

/**
 * Find first already exists file.
 * @param files - Absolute file paths with extension.
 * @returns The file path if exists, or false if no file exists.
 */
export const findExists = (files: string[]): string | false => {
  for (const file of files) {
    if (isFileSync(file)) {
      return file;
    }
  }
  return false;
};

export async function pathExists(path: string): Promise<boolean> {
  return fs.promises
    .access(path)
    .then(() => true)
    .catch(() => false);
}

export async function isFileExists(file: string): Promise<boolean> {
  return fs.promises
    .access(file, fs.constants.F_OK)
    .then(() => true)
    .catch(() => false);
}

export async function fileExistsByCompilation(
  { inputFileSystem }: Rspack.Compilation,
  filePath: string,
): Promise<boolean> {
  return new Promise((resolve) => {
    if (!inputFileSystem) {
      resolve(false);
      return;
    }
    inputFileSystem.stat(filePath, (err, stats) => {
      if (err) {
        resolve(false);
      } else {
        resolve(Boolean(stats?.isFile()));
      }
    });
  });
}

/**
 * Read file asynchronously using Rspack compiler's filesystem.
 */
export function readFileAsync(
  fs: NonNullable<Rspack.Compilation['inputFileSystem'] | Rspack.OutputFileSystem>,
  filename: string,
): Promise<Buffer | string> {
  return new Promise((resolve, reject) => {
    fs.readFile(filename, (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      if (data === undefined) {
        reject(new Error(`Failed to read file: ${filename}, data is undefined`));
        return;
      }
      resolve(data);
    });
  });
}

export async function emptyDir(
  dir: string,
  logger: Logger,
  keep: RegExp[] = [],
  checkExists = true,
): Promise<void> {
  if (checkExists && !(await pathExists(dir))) {
    return;
  }

  try {
    const entries = await fs.promises.readdir(dir, {
      withFileTypes: true,
    });

    await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(dir, entry.name);
        if (keep.length) {
          const posixFullPath = toPosixPath(fullPath);
          if (keep.some((regex) => regex.test(posixFullPath))) {
            return;
          }
        }

        if (entry.isDirectory()) {
          await emptyDir(fullPath, logger, keep, false);
          if (!keep.length) {
            await fs.promises.rmdir(fullPath);
          }
        } else {
          await fs.promises.unlink(fullPath);
        }
      }),
    );
  } catch (err) {
    logger.debug(`failed to empty dir: ${dir}`);
    logger.debug(err);
  }
}
