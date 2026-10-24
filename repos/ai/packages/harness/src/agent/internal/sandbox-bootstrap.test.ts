import type { Experimental_SandboxSession as SandboxSession } from '@ai-sdk/provider-utils';
import { describe, expect, it, vi } from 'vitest';
import type { HarnessV1Bootstrap } from '../../v1';
import { hashHarnessBootstrap } from './bootstrap-recipe';
import {
  createSandboxBootstrapPlan,
  normalizeSandboxWorkDir,
  resolveSessionWorkDir,
  runSandboxBootstrap,
  validateSandboxBootstrapSettings,
} from './sandbox-bootstrap';

const recipe: HarnessV1Bootstrap = {
  harnessId: 'demo',
  bootstrapDir: '/tmp/harness/demo',
  files: [{ path: '/tmp/harness/demo/a.txt', content: 'one' }],
  commands: [{ command: 'echo ok' }],
};

function makeSession(): {
  session: SandboxSession;
  run: ReturnType<typeof vi.fn>;
  readTextFile: ReturnType<typeof vi.fn>;
  writeTextFile: ReturnType<typeof vi.fn>;
} {
  const run = vi.fn(async (args: { command: string }) => {
    if (args.command === 'pwd') {
      return { exitCode: 0, stdout: '/work\n', stderr: '' };
    }
    return { exitCode: 0, stdout: '', stderr: '' };
  });
  const readTextFile = vi.fn(async () => null);
  const writeTextFile = vi.fn(async () => {});
  return {
    session: {
      description: 'mock',
      run,
      readTextFile,
      writeTextFile,
    } as unknown as SandboxSession,
    run,
    readTextFile,
    writeTextFile,
  };
}

describe('validateSandboxBootstrapSettings', () => {
  it('requires onBootstrap and bootstrapHash together', () => {
    expect(() =>
      validateSandboxBootstrapSettings({
        onBootstrap: async () => {},
      }),
    ).toThrow(/must be provided together/);

    expect(() =>
      validateSandboxBootstrapSettings({
        bootstrapHash: 'hash',
      }),
    ).toThrow(/must be provided together/);
  });

  it('rejects invalid workDir values', () => {
    for (const value of ['', '.', '/repo', '../repo', 'repo/../../x', 'a\\b']) {
      expect(() =>
        validateSandboxBootstrapSettings({
          workDir: value,
        }),
      ).toThrow(/workDir/);
    }
  });

  it('normalizes workDir values that stay inside the default cwd', () => {
    expect(normalizeSandboxWorkDir('repo/../ai-sdk')).toBe('ai-sdk');
    expect(normalizeSandboxWorkDir('./ai-sdk')).toBe('ai-sdk');
  });
});

describe('createSandboxBootstrapPlan', () => {
  it('preserves the built-in bootstrap identity when no new settings are used', async () => {
    const plan = await createSandboxBootstrapPlan({
      recipe,
      settings: {},
    });

    expect(plan.identity).toBe(await hashHarnessBootstrap(recipe));
  });

  it('changes identity when caller bootstrap hash changes', async () => {
    const a = await createSandboxBootstrapPlan({
      recipe,
      settings: {
        bootstrapHash: 'repo-v1',
        onBootstrap: async () => {},
      },
    });
    const b = await createSandboxBootstrapPlan({
      recipe,
      settings: {
        bootstrapHash: 'repo-v2',
        onBootstrap: async () => {},
      },
    });

    expect(a.identity).not.toBe(b.identity);
  });

  it('changes identity when workDir changes', async () => {
    const a = await createSandboxBootstrapPlan({
      recipe,
      settings: { workDir: 'repo-a' },
    });
    const b = await createSandboxBootstrapPlan({
      recipe,
      settings: { workDir: 'repo-b' },
    });

    expect(a.identity).not.toBe(b.identity);
  });
});

describe('resolveSessionWorkDir', () => {
  it('uses the session-scoped default path when workDir is absent', () => {
    expect(
      resolveSessionWorkDir({
        defaultWorkingDirectory: '/work',
        harnessId: 'mock',
        sessionId: 's1',
      }),
    ).toBe('/work/mock-s1');
  });

  it('uses the stable workDir when provided', () => {
    expect(
      resolveSessionWorkDir({
        defaultWorkingDirectory: '/work',
        harnessId: 'mock',
        sessionId: 's1',
        workDir: 'ai-sdk',
      }),
    ).toBe('/work/ai-sdk');
  });
});

describe('runSandboxBootstrap', () => {
  it('runs built-in bootstrap before caller bootstrap', async () => {
    const { session, run } = makeSession();
    const onSandboxBootstrap = vi.fn(async () => {});
    const recipeIdentity = await hashHarnessBootstrap(recipe);

    await runSandboxBootstrap({
      session,
      recipe,
      recipeIdentity,
      workDir: 'ai-sdk',
      onBootstrap: onSandboxBootstrap,
    });

    expect(onSandboxBootstrap).toHaveBeenCalledWith({
      session,
      workDir: '/work/ai-sdk',
      abortSignal: undefined,
    });
    expect(run.mock.calls.map(([args]) => args.command)).toEqual([
      'echo ok',
      'pwd',
      'mkdir -p "$WORK_DIR"',
    ]);
    expect(run.mock.invocationCallOrder[0]!).toBeLessThan(
      onSandboxBootstrap.mock.invocationCallOrder[0]!,
    );
  });

  it('uses the default cwd for caller bootstrap when workDir is absent', async () => {
    const { session } = makeSession();
    const onSandboxBootstrap = vi.fn(async () => {});

    await runSandboxBootstrap({
      session,
      onBootstrap: onSandboxBootstrap,
    });

    expect(onSandboxBootstrap).toHaveBeenCalledWith({
      session,
      workDir: '/work',
      abortSignal: undefined,
    });
  });
});
