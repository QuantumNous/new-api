import { readdirSync } from 'node:fs';
import { defineConfig, defineProject } from 'vitest/config';

export default defineConfig({
  test: {
    projects: readdirSync('./test/typescript', { withFileTypes: true })
      .filter((dir) => dir.isDirectory())
      // Exclude issue-1899 - it runs separately via test:typescript:issue-1899
      // because it requires skipLibCheck: false which exposes @types/node errors
      .filter((dir) => dir.name !== 'issue-1899')
      .reduce<ReturnType<typeof defineProject>[]>((workspaces, dir) => {
        const dirPath = `test/typescript/${dir.name}` as const;

        const tsConfigFiles = readdirSync(dirPath).filter(
          // Do not include temporary vitest tsconfig files
          (it) => it.startsWith('tsconfig.') && it.endsWith('.json') && !it.includes('vitest-temp'),
        );

        tsConfigFiles.forEach((tsConfigFileName) => {
          const workspaceName =
            tsConfigFileName === 'tsconfig.json'
              ? `typescript-${dir.name}`
              : `${dir.name}-${tsConfigFileName.split('.')[1]}`;

          workspaces.push(
            defineProject({
              test: {
                name: workspaceName,
                alias: {
                  /**
                   * Imports are resolved even if we are running only typecheck tests.
                   * This will result in:
                   * ```text
                   * Error: Failed to resolve entry for package "react-i18next". The package may have incorrect main/module/exports specified in its package.json.
                   * ```
                   * To avoid a useless build process before running these tests a stub alias to `react-i18next` is added.
                   */
                  'react-i18next': './test/typescript/_stub.js',
                },
                typecheck: {
                  enabled: true,
                  only: true,
                  include: [`./${dirPath}/*.test.{ts,tsx}`],
                  tsconfig: `./${dirPath}/${tsConfigFileName}`,
                },
              },
            }),
          );
        });

        return workspaces;
      }, []),
  },
});
