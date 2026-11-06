import { tool } from 'ai';
import { z } from 'zod';

export function sandboxShellTool() {
  return tool({
    description: 'Run a shell command',
    inputSchema: z.object({
      command: z.string(),
      workingDirectory: z.string().optional(),
    }),

    execute: async (
      { command, workingDirectory },
      { abortSignal, experimental_sandbox: sandbox },
    ) => {
      // TODO figure out type inference to turn the runtime error into a type error
      if (!sandbox) {
        throw new Error('Sandbox is not available');
      }
      return sandbox.run({
        command,
        workingDirectory,
        abortSignal,
      });
    },
  });
}
