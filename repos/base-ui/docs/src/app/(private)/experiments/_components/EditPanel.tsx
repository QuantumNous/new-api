import * as React from 'react';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { basename, dirname, extname, resolve } from 'node:path';
import type { DemoFile } from 'docs/src/blocks/Demo';
import { SandboxLink } from './SandboxLink';

/**
 * Looks for local imports in the file content and resolves them to absolute paths.
 *
 * @param content JS/TS file content.
 * @param baseDirectory Directory the file is located in.
 */
function getLocalImports(content: string, baseDirectory: string): string[] {
  const localPaths = [
    // import { foo } from './foo'
    ...(content.match(/from ['"]\.\.?\/[^'"]+['"]/g)?.map((match) => match.slice(6, -1)) ?? []),
    // import './foo'
    ...(content.match(/import ['"]\.\.?\/[^'"]+['"]/g)?.map((match) => match.slice(8, -1)) ?? []),
  ];

  return localPaths.map((file) => resolve(baseDirectory, file));
}

/**
 * Lists all the dependencies of the provided files, including transitive dependencies (only in case of JS/TS files).
 *
 * @param paths Paths to the files to read.
 * @param preferTs Whether to prefer TS files over JS files when resolving extensionless imports.
 */
export async function getDependencyFiles(
  paths: string[],
  preferTs: boolean,
  visited: Set<string> = new Set(),
): Promise<DemoFile[]> {
  const files = await Promise.all(
    paths.map(async (path) => {
      let extension = extname(path);

      if (extension === '') {
        path = resolveExtensionlessFile(path, preferTs);
        extension = extname(path);
      }

      if (visited.has(path)) {
        return [];
      }
      visited.add(path);

      let type: string;
      if (extension === '.ts' || extension === '.tsx') {
        type = 'ts';
      } else if (extension === '.js' || extension === '.jsx') {
        type = 'js';
      } else {
        type = extension.slice(1);
      }

      const content = await readFile(path, 'utf-8');

      const canHaveDependencies = type === 'ts' || type === 'js';
      const transitiveDependencies = canHaveDependencies
        ? await getDependencyFiles(getLocalImports(content, dirname(path)), type === 'ts', visited)
        : [];

      return [
        {
          name: basename(path),
          content,
          path,
          type,
        } satisfies DemoFile,
        ...transitiveDependencies,
      ];
    }),
  );

  return files.flat();
}

/**
 * Given a file path without an extension, resolves it to a file with one of the supported extensions.
 *
 * @param filePath Path to the file without an extension.
 * @param preferTs Whether to prefer TS files over JS files.
 */
function resolveExtensionlessFile(filePath: string, preferTs: boolean): string {
  const extensions = preferTs
    ? ['.tsx', '.ts', '.jsx', '.js', '.json']
    : ['.jsx', '.js', '.tsx', '.ts', '.json'];

  for (const extension of extensions) {
    const fullPath = `${filePath}${extension}`;
    if (existsSync(fullPath)) {
      return fullPath;
    }
  }

  for (const extension of extensions) {
    const fullPath = `${filePath}/index${extension}`;
    if (existsSync(fullPath)) {
      return fullPath;
    }
  }

  throw new Error(
    `Could not find the file ${filePath} with any of the supported extensions: ${extensions.join(', ')}.`,
  );
}

const currentDirectory = dirname(fileURLToPath(import.meta.url));

export async function EditPanel(props: EditPanelProps) {
  const { experimentPath, ...otherProps } = props;

  const dependencies = await getDependencyFiles(
    [experimentPath, resolve(currentDirectory, './SettingsPanel.tsx')],
    true,
  );

  return (
    <div {...otherProps}>
      <h2>Edit</h2>
      <SandboxLink files={dependencies}>Open in CodeSandbox ({experimentPath})</SandboxLink>
    </div>
  );
}

interface EditPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  experimentPath: string;
}
