import path from 'node:path';
import type { Experimental_SandboxSession } from '@ai-sdk/provider-utils';

export async function resolveSandboxHomeDir({
  sandbox,
  abortSignal,
}: {
  sandbox: Experimental_SandboxSession;
  abortSignal?: AbortSignal;
}): Promise<string> {
  const result = await sandbox.run({
    command: 'printf "%s" "$HOME"',
    abortSignal,
  });
  const homeDir = result.stdout.trim();
  if (result.exitCode !== 0 || !homeDir || !path.posix.isAbsolute(homeDir)) {
    throw new Error(
      `Unable to resolve sandbox HOME directory: ${result.stderr || result.stdout}`,
    );
  }
  return homeDir;
}
