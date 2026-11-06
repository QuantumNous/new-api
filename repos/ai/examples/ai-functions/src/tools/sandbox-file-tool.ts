import { tool } from 'ai';
import { z } from 'zod';

export function sandboxReadTextFileTool() {
  return tool({
    description:
      'Read a UTF-8 text file from the sandbox. Returns null content when the file does not exist.',
    inputSchema: z.object({
      path: z.string(),
      startLine: z.number().int().min(1).optional(),
      endLine: z.number().int().min(1).optional(),
    }),

    execute: async (
      { path, startLine, endLine },
      { abortSignal, experimental_sandbox: sandbox },
    ) => {
      if (!sandbox) {
        throw new Error('Sandbox is not available');
      }
      const content = await sandbox.readTextFile({
        path,
        startLine,
        endLine,
        abortSignal,
      });
      return { content };
    },
  });
}

export function sandboxWriteTextFileTool() {
  return tool({
    description:
      'Write a UTF-8 text file to the sandbox. Creates parent directories and overwrites any existing file.',
    inputSchema: z.object({
      path: z.string(),
      content: z.string(),
    }),

    execute: async (
      { path, content },
      { abortSignal, experimental_sandbox: sandbox },
    ) => {
      if (!sandbox) {
        throw new Error('Sandbox is not available');
      }
      await sandbox.writeTextFile({ path, content, abortSignal });
      return { ok: true };
    },
  });
}
