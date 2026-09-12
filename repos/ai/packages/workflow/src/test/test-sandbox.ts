import type { Experimental_SandboxSession as SandboxSession } from 'ai';

/**
 * Build a minimal {@link SandboxSession} for tests. Only `run` returns a usable
 * result by default; every other method throws so tests stay explicit about
 * what they exercise. Pass `overrides` to customize individual methods.
 */
export function createTestSandbox(
  overrides: Partial<SandboxSession> = {},
): SandboxSession {
  const notImplemented = () => {
    throw new Error('not implemented in test sandbox');
  };
  return {
    description: 'test sandbox',
    readFile: notImplemented,
    readBinaryFile: notImplemented,
    readTextFile: notImplemented,
    writeFile: notImplemented,
    writeBinaryFile: notImplemented,
    writeTextFile: notImplemented,
    spawn: notImplemented,
    run: async () => ({ exitCode: 0, stdout: '', stderr: '' }),
    ...overrides,
  };
}
