import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import type { UserProjectConfigExport } from 'vitest/config';

export default defineConfig({
  test: {
    projects:
      /**
       * If you need to test multiple typescript configurations (like misc) simply create a file named tsconfig.{customName}.json
       * and this script will automatically create a new workspace named with the dirName followed by `customName`
       */
      readdirSync('./test/typescript', { withFileTypes: true })
        .filter((dir) => dir.isDirectory())
        .reduce<UserProjectConfigExport[]>((workspaces, dir) => {
          const dirPath = `test/typescript/${dir.name}` as const;

          const tsConfigFiles = readdirSync(dirPath).filter(
            // Do not include temporary vitest tsconfig files
            (it) =>
              it.startsWith('tsconfig.') && it.endsWith('.json') && !it.includes('vitest-temp'),
          );

          tsConfigFiles.forEach((tsConfigFileName) => {
            const workspaceName =
              tsConfigFileName === 'tsconfig.json'
                ? dir.name
                : `${dir.name}-${tsConfigFileName.split('.')[1]}`;

            const workspaceConfig: UserProjectConfigExport = {
              test: {
                dir: `./${dirPath}`,
                name: workspaceName,
                alias: {
                  /**
                   * From `vitest` >= 2 imports are resolved even if we are running only typecheck tests.
                   * This will result in:
                   * ```text
                   * Error: Failed to resolve entry for package "i18next". The package may have incorrect main/module/exports specified in its package.json.
                   * ```
                   * To avoid a useless build process before running these tests an empty alias to `i18n` is added.
                   */
                  i18next: resolve(import.meta.dirname, 'test/typescript/_stub.js'),
                },
                typecheck: {
                  enabled: true,
                  only: true,
                  include: ['**/*.test.ts'],
                  tsconfig: `./${dirPath}/${tsConfigFileName}`,
                },
              },
            };
            workspaces.push(workspaceConfig);
          });

          return workspaces;
        }, []),
  },
});
