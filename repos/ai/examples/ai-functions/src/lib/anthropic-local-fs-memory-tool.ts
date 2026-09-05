import { anthropic } from '@ai-sdk/anthropic';
import * as fsSync from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';

// based on
// https://github.com/anthropics/anthropic-sdk-typescript/blob/main/examples/tools-helpers-memory.ts
export const anthropicLocalFsMemoryTool = ({
  basePath = './memory',
}: {
  basePath: string;
}) => {
  const memoryRoot = path.join(basePath, 'memories');

  if (!fsSync.existsSync(memoryRoot)) {
    fsSync.mkdirSync(memoryRoot, { recursive: true });
  }

  function validatePath(memoryPath: string): string {
    if (!memoryPath.startsWith('/memories')) {
      throw new Error(`Path must start with /memories, got: ${memoryPath}`);
    }

    const relativePath = memoryPath
      .slice('/memories'.length)
      .replace(/^\//, '');
    const fullPath = relativePath
      ? path.join(memoryRoot, relativePath)
      : memoryRoot;

    const resolvedPath = path.resolve(fullPath);
    const resolvedRoot = path.resolve(memoryRoot);
    if (!resolvedPath.startsWith(resolvedRoot)) {
      throw new Error(`Path ${memoryPath} would escape /memories directory`);
    }

    return resolvedPath;
  }

  async function exists(path: string) {
    return await fs
      .access(path)
      .then(() => true)
      .catch(() => false);
  }

  return anthropic.tools.memory_20250818({
    execute: async action => {
      switch (action.command) {
        case 'view': {
          const fullPath = validatePath(action.path);

          if (!(await exists(fullPath))) {
            throw new Error(`Path not found: ${action.path}`);
          }

          const stat = await fs.stat(fullPath);

          if (stat.isDirectory()) {
            const items: string[] = [];
            const dirContents = await fs.readdir(fullPath);

            for (const item of dirContents.sort()) {
              if (item.startsWith('.')) {
                continue;
              }
              const itemPath = path.join(fullPath, item);
              const itemStat = await fs.stat(itemPath);
              items.push(itemStat.isDirectory() ? `${item}/` : item);
            }

            return (
              `Directory: ${action.path}\n` +
              items.map(item => `- ${item}`).join('\n')
            );
          } else if (stat.isFile()) {
            const content = await fs.readFile(fullPath, 'utf-8');
            const lines = content.split('\n');

            let displayLines = lines;
            let startNum = 1;

            if (action.view_range && action.view_range.length === 2) {
              const startLine = Math.max(1, action.view_range[0]!) - 1;
              const endLine =
                action.view_range[1] === -1
                  ? lines.length
                  : action.view_range[1];
              displayLines = lines.slice(startLine, endLine);
              startNum = startLine + 1;
            }

            const numberedLines = displayLines.map(
              (line, i) => `${String(i + startNum).padStart(4, ' ')}: ${line}`,
            );

            return numberedLines.join('\n');
          } else {
            throw new Error(`Path not found: ${action.path}`);
          }
        }

        case 'create': {
          const fullPath = validatePath(action.path);
          const dir = path.dirname(fullPath);

          if (!(await exists(dir))) {
            await fs.mkdir(dir, { recursive: true });
          }

          await fs.writeFile(fullPath, action.file_text, 'utf-8');
          return `File created successfully at ${action.path}`;
        }

        case 'str_replace': {
          const fullPath = validatePath(action.path);

          if (!(await exists(fullPath))) {
            throw new Error(`File not found: ${action.path}`);
          }

          const stat = await fs.stat(fullPath);
          if (!stat.isFile()) {
            throw new Error(`Path is not a file: ${action.path}`);
          }

          const content = await fs.readFile(fullPath, 'utf-8');
          const count = content.split(action.old_str).length - 1;

          if (count === 0) {
            throw new Error(`Text not found in ${action.path}`);
          } else if (count > 1) {
            throw new Error(
              `Text appears ${count} times in ${action.path}. Must be unique.`,
            );
          }

          const newContent = content.replace(action.old_str, action.new_str);
          await fs.writeFile(fullPath, newContent, 'utf-8');
          return `File ${action.path} has been edited`;
        }

        case 'insert': {
          const fullPath = validatePath(action.path);

          if (!(await exists(fullPath))) {
            throw new Error(`File not found: ${action.path}`);
          }

          const stat = await fs.stat(fullPath);
          if (!stat.isFile()) {
            throw new Error(`Path is not a file: ${action.path}`);
          }

          const content = await fs.readFile(fullPath, 'utf-8');
          const lines = content.split('\n');

          if (action.insert_line < 0 || action.insert_line > lines.length) {
            throw new Error(
              `Invalid insert_line ${action.insert_line}. Must be 0-${lines.length}`,
            );
          }

          lines.splice(
            action.insert_line,
            0,
            action.insert_text.replace(/\n$/, ''),
          );
          await fs.writeFile(fullPath, lines.join('\n'), 'utf-8');
          return `Text inserted at line ${action.insert_line} in ${action.path}`;
        }

        case 'delete': {
          const fullPath = validatePath(action.path);

          if (action.path === '/memories') {
            throw new Error('Cannot delete the /memories directory itself');
          }

          if (!(await exists(fullPath))) {
            throw new Error(`Path not found: ${action.path}`);
          }

          const stat = await fs.stat(fullPath);

          if (stat.isFile()) {
            await fs.unlink(fullPath);
            return `File deleted: ${action.path}`;
          } else if (stat.isDirectory()) {
            await fs.rmdir(fullPath, { recursive: true });
            return `Directory deleted: ${action.path}`;
          } else {
            throw new Error(`Path not found: ${action.path}`);
          }
        }

        case 'rename': {
          const oldFullPath = validatePath(action.old_path);
          const newFullPath = validatePath(action.new_path);

          if (!(await exists(oldFullPath))) {
            throw new Error(`Source path not found: ${action.old_path}`);
          }

          if (await exists(newFullPath)) {
            throw new Error(`Destination already exists: ${action.new_path}`);
          }

          const newDir = path.dirname(newFullPath);
          if (!(await exists(newDir))) {
            await fs.mkdir(newDir, { recursive: true });
          }

          await fs.rename(oldFullPath, newFullPath);
          return `Renamed ${action.old_path} to ${action.new_path}`;
        }
      }
    },
  });
};
