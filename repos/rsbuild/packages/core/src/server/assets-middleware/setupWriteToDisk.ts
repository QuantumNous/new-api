import fs from 'node:fs';
import path from 'node:path';
import type { Compilation, Compiler } from '@rspack/core';
import type { Logger } from '../../logger';
import type { EnvironmentContext, NormalizedDevConfig } from '../../types';

declare module '@rspack/core' {
  interface Compiler {
    __hasRsbuildAssetEmittedCallback?: boolean;
  }
}

export type ResolvedWriteToDisk = boolean | ((filePath: string, name?: string) => boolean);

/**
 * Resolve writeToDisk config across multiple environments.
 * Returns the unified config if all environments have the same value,
 * otherwise returns a function that resolves config based on compilation.
 */
export const resolveWriteToDiskConfig = (
  config: NormalizedDevConfig,
  environments: Record<string, EnvironmentContext>,
  environmentList: EnvironmentContext[],
): ResolvedWriteToDisk => {
  const writeToDiskValues = environmentList.map((env) => env.config.dev.writeToDisk);
  if (new Set(writeToDiskValues).size === 1) {
    return writeToDiskValues[0];
  }

  return (filePath: string, name?: string) => {
    let { writeToDisk } = config;
    if (name && environments[name]) {
      writeToDisk = environments[name].config.dev.writeToDisk ?? writeToDisk;
    }
    return typeof writeToDisk === 'function' ? writeToDisk(filePath) : writeToDisk;
  };
};

export function setupWriteToDisk(
  compilers: Compiler[],
  writeToDisk: ResolvedWriteToDisk,
  logger: Logger,
): void {
  for (const compiler of compilers) {
    compiler.hooks.emit.tap('DevMiddleware', () => {
      if (compiler.__hasRsbuildAssetEmittedCallback) {
        return;
      }

      compiler.hooks.assetEmitted.tapAsync(
        'DevMiddleware',
        (
          _file: string,
          info: {
            targetPath: string;
            content: Buffer;
            compilation: Compilation;
          },
          callback: (err?: Error) => void,
        ) => {
          const { targetPath, content, compilation } = info;
          const allowWrite =
            writeToDisk && typeof writeToDisk === 'function'
              ? writeToDisk(targetPath, compilation.name)
              : true;

          if (!allowWrite) {
            callback();
            return;
          }

          const dir = path.dirname(targetPath);
          const name = compiler.options.name ? `Child "${compiler.options.name}": ` : '';

          fs.mkdir(dir, { recursive: true }, (mkdirError: NodeJS.ErrnoException | null) => {
            if (mkdirError) {
              logger.error(
                `[rsbuild:middleware] ${name}Unable to write "${dir}" directory to disk:\n${mkdirError.message}`,
              );

              callback(mkdirError);
              return;
            }

            fs.writeFile(targetPath, content, (writeFileError: NodeJS.ErrnoException | null) => {
              if (writeFileError) {
                logger.error(
                  `[rsbuild:middleware] ${name}Unable to write "${targetPath}" asset to disk:\n${writeFileError.message}`,
                );

                callback(writeFileError);
                return;
              }

              callback();
            });
          });
        },
      );

      compiler.__hasRsbuildAssetEmittedCallback = true;
    });
  }
}
