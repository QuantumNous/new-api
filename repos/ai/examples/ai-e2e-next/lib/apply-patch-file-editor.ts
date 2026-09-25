import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { applyDiff } from './apply-diff';

export type ApplyPatchOperation =
  | {
      type: 'create_file';
      path: string;
      diff: string;
    }
  | {
      type: 'delete_file';
      path: string;
    }
  | {
      type: 'update_file';
      path: string;
      diff: string;
    };

export function createApplyPatchExecutor(workspaceRoot: string) {
  const editor = new WorkspaceEditor(workspaceRoot);

  return async ({
    callId,
    operation,
  }: {
    callId: string;
    operation: ApplyPatchOperation;
  }): Promise<{ status: 'completed' | 'failed'; output?: string }> => {
    console.log(`[${callId}] Applying ${operation.type} to ${operation.path}`);

    switch (operation.type) {
      case 'create_file':
        return editor.createFile(operation);
      case 'update_file':
        return editor.updateFile(operation);
      case 'delete_file':
        return editor.deleteFile(operation);
    }
  };
}

export class WorkspaceEditor {
  constructor(private readonly root: string) {}

  async createFile(
    operation: Extract<ApplyPatchOperation, { type: 'create_file' }>,
  ): Promise<{ status: 'completed' | 'failed'; output?: string }> {
    try {
      const targetPath = await this.resolve(operation.path);
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      const content = applyDiff('', operation.diff, 'create');
      await fs.writeFile(targetPath, content, 'utf8');
      return { status: 'completed', output: `Created ${operation.path}` };
    } catch (error: any) {
      return {
        status: 'failed',
        output: `Error creating file: ${error.message}`,
      };
    }
  }

  async updateFile(
    operation: Extract<ApplyPatchOperation, { type: 'update_file' }>,
  ): Promise<{ status: 'completed' | 'failed'; output?: string }> {
    try {
      const targetPath = await this.resolve(operation.path);
      const original = await fs
        .readFile(targetPath, 'utf8')
        .catch((error: any) => {
          if (error?.code === 'ENOENT') {
            throw new Error(`Cannot update missing file: ${operation.path}`);
          }
          throw error;
        });
      const patched = applyDiff(original, operation.diff);
      await fs.writeFile(targetPath, patched, 'utf8');
      return { status: 'completed', output: `Updated ${operation.path}` };
    } catch (error: any) {
      return {
        status: 'failed',
        output: `Error updating file: ${error.message}`,
      };
    }
  }

  async deleteFile(
    operation: Extract<ApplyPatchOperation, { type: 'delete_file' }>,
  ): Promise<{ status: 'completed' | 'failed'; output?: string }> {
    try {
      const targetPath = await this.resolve(operation.path);
      await fs.rm(targetPath, { force: true });
      return { status: 'completed', output: `Deleted ${operation.path}` };
    } catch (error: any) {
      return {
        status: 'failed',
        output: `Error deleting file: ${error.message}`,
      };
    }
  }

  async readFile(filePath: string): Promise<string> {
    const targetPath = await this.resolve(filePath);
    return await fs.readFile(targetPath, 'utf8');
  }

  private async resolve(relativePath: string): Promise<string> {
    const rootPath = path.resolve(this.root);
    const targetPath = path.resolve(rootPath, relativePath);

    const relative = path.relative(rootPath, targetPath);

    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error(`Operation outside workspace: ${relativePath}`);
    }

    return targetPath;
  }
}
