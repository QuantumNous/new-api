import type { Experimental_SandboxSession as SandboxSession } from '@ai-sdk/provider-utils';
import { describe, expect, it, vi } from 'vitest';
import type { HarnessV1, HarnessV1Bootstrap } from '../v1';
import { hashHarnessBootstrap } from './internal/bootstrap-recipe';
import { prepareSandboxForHarness } from './prepare-sandbox-for-harness';

function makeRecipe(harnessId: string): HarnessV1Bootstrap {
  return {
    harnessId,
    bootstrapDir: `/tmp/harness/${harnessId}`,
    files: [
      {
        path: `/tmp/harness/${harnessId}/file.txt`,
        content: harnessId,
      },
    ],
    commands: [{ command: `echo ${harnessId}` }],
  };
}

function makeHarness({
  harnessId,
  recipe,
}: {
  readonly harnessId: string;
  readonly recipe?: HarnessV1Bootstrap;
}): HarnessV1 {
  return {
    specificationVersion: 'harness-v1',
    harnessId,
    builtinTools: {},
    ...(recipe != null ? { getBootstrap: vi.fn(async () => recipe) } : {}),
    doStart: async () => {
      throw new Error('not used');
    },
  };
}

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

describe('prepareSandboxForHarness', () => {
  it('prepares multiple harnesses in sorted order and returns metadata', async () => {
    const { session, run } = makeSession();
    const alphaRecipe = makeRecipe('alpha');
    const betaRecipe = makeRecipe('beta');
    const alpha = makeHarness({ harnessId: 'alpha', recipe: alphaRecipe });
    const beta = makeHarness({ harnessId: 'beta', recipe: betaRecipe });
    const onBootstrap = vi.fn(async () => {});

    const result = await prepareSandboxForHarness({
      session,
      harnesses: [beta, alpha],
      sandboxConfig: {
        workDir: 'repo',
        bootstrapHash: 'repo-v1',
        onBootstrap,
      },
    });

    expect(result).toEqual({
      identity: expect.stringMatching(/^[0-9a-f]{16}$/),
      recipeIdentities: {
        alpha: await hashHarnessBootstrap(alphaRecipe),
        beta: await hashHarnessBootstrap(betaRecipe),
      },
      skippedHarnessIds: [],
    });
    expect(run.mock.calls.map(([args]) => args.command)).toEqual([
      'echo alpha',
      'echo beta',
      'pwd',
      'mkdir -p "$WORK_DIR"',
    ]);
    expect(onBootstrap).toHaveBeenCalledWith({
      session,
      workDir: '/work/repo',
      abortSignal: undefined,
    });
  });

  it('returns the same identity for the same harnesses in a different order', async () => {
    const alpha = makeHarness({
      harnessId: 'alpha',
      recipe: makeRecipe('alpha'),
    });
    const beta = makeHarness({
      harnessId: 'beta',
      recipe: makeRecipe('beta'),
    });

    const first = await prepareSandboxForHarness({
      session: makeSession().session,
      harnesses: [alpha, beta],
      sandboxConfig: { workDir: 'repo' },
    });
    const second = await prepareSandboxForHarness({
      session: makeSession().session,
      harnesses: [beta, alpha],
      sandboxConfig: { workDir: 'repo' },
    });

    expect(first.identity).toBe(second.identity);
    expect(first.recipeIdentities).toEqual(second.recipeIdentities);
  });

  it('skips harnesses without bootstrap recipes', async () => {
    const { session, run } = makeSession();
    const pi = makeHarness({ harnessId: 'pi' });

    const result = await prepareSandboxForHarness({
      session,
      harnesses: [pi],
    });

    expect(result).toEqual({
      recipeIdentities: {},
      skippedHarnessIds: ['pi'],
    });
    expect(run).not.toHaveBeenCalled();
  });

  it('rejects duplicate harness ids', async () => {
    const first = makeHarness({ harnessId: 'alpha', recipe: makeRecipe('a') });
    const second = makeHarness({ harnessId: 'alpha', recipe: makeRecipe('b') });

    await expect(
      prepareSandboxForHarness({
        session: makeSession().session,
        harnesses: [first, second],
      }),
    ).rejects.toThrow(/duplicate harness id/);
  });

  it('validates caller bootstrap settings', async () => {
    await expect(
      prepareSandboxForHarness({
        session: makeSession().session,
        harnesses: [makeHarness({ harnessId: 'alpha' })],
        sandboxConfig: { onBootstrap: async () => {} },
      }),
    ).rejects.toThrow(/must be provided together/);

    await expect(
      prepareSandboxForHarness({
        session: makeSession().session,
        harnesses: [makeHarness({ harnessId: 'alpha' })],
        sandboxConfig: { workDir: '../repo' },
      }),
    ).rejects.toThrow(/workDir/);
  });

  it('accepts a full HarnessAgent sandboxConfig and ignores onSession', async () => {
    const { session } = makeSession();
    const onSession = vi.fn(async () => {});

    await prepareSandboxForHarness({
      session,
      harnesses: [
        makeHarness({ harnessId: 'alpha', recipe: makeRecipe('alpha') }),
      ],
      sandboxConfig: {
        onSession,
      },
    });

    expect(onSession).not.toHaveBeenCalled();
  });
});
