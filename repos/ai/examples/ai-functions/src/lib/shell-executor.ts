import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export async function executeShellCommand(
  command: string,
  timeoutMs?: number,
): Promise<{
  stdout: string;
  stderr: string;
  outcome: { type: 'timeout' } | { type: 'exit'; exitCode: number };
}> {
  const timeout = timeoutMs ?? 60_000; // Default 60 seconds

  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout,
      maxBuffer: 10 * 1024 * 1024,
    });

    return {
      stdout: stdout || '',
      stderr: stderr || '',
      outcome: { type: 'exit', exitCode: 0 },
    };
  } catch (error: any) {
    const timedOut = error?.killed || error?.signal === 'SIGTERM';
    const exitCode = timedOut ? null : (error?.code ?? 1);

    return {
      stdout: error?.stdout ?? '',
      stderr: error?.stderr ?? String(error),
      outcome: timedOut
        ? { type: 'timeout' }
        : { type: 'exit', exitCode: exitCode ?? 1 },
    };
  }
}
