import { describe, expect, it } from 'vitest';
import type { Experimental_SandboxSession } from '@ai-sdk/provider-utils';
import { resolveSandboxHomeDir } from './sandbox-home-dir';

function makeSandbox(result: {
  exitCode: number;
  stdout: string;
  stderr: string;
}): Experimental_SandboxSession {
  return {
    async run() {
      return result;
    },
  } as unknown as Experimental_SandboxSession;
}

describe('resolveSandboxHomeDir', () => {
  it('returns an absolute HOME directory', async () => {
    await expect(
      resolveSandboxHomeDir({
        sandbox: makeSandbox({
          exitCode: 0,
          stdout: '/home/vercel-sandbox\n',
          stderr: '',
        }),
      }),
    ).resolves.toBe('/home/vercel-sandbox');
  });

  it('rejects non-absolute output', async () => {
    await expect(
      resolveSandboxHomeDir({
        sandbox: makeSandbox({
          exitCode: 0,
          stdout: 'home/user',
          stderr: '',
        }),
      }),
    ).rejects.toThrow('Unable to resolve sandbox HOME directory');
  });
});
