import type { Experimental_SandboxSession as SandboxSession } from '@ai-sdk/provider-utils';
import { describe, expect, it, vi } from 'vitest';
import type { HarnessV1Bootstrap } from '../../v1';
import {
  BOOTSTRAP_SCHEMA_VERSION,
  applyBootstrapRecipe,
  bootstrapMarkerPath,
  hashHarnessBootstrap,
} from './bootstrap-recipe';

const baseRecipe: HarnessV1Bootstrap = {
  harnessId: 'demo',
  bootstrapDir: '/tmp/harness/demo',
  files: [
    { path: '/tmp/harness/demo/a.txt', content: 'one' },
    { path: '/tmp/harness/demo/b.txt', content: 'two' },
  ],
  commands: [{ command: 'mkdir -p /tmp/harness/demo' }, { command: 'echo ok' }],
};

describe('hashHarnessBootstrap', () => {
  it('produces a deterministic 16-char hex id for the same recipe', async () => {
    const a = await hashHarnessBootstrap(baseRecipe);
    const b = await hashHarnessBootstrap(baseRecipe);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{16}$/);
  });

  it('is unaffected by file ordering in the recipe', async () => {
    const reordered: HarnessV1Bootstrap = {
      ...baseRecipe,
      files: [...baseRecipe.files].reverse(),
    };
    expect(await hashHarnessBootstrap(baseRecipe)).toBe(
      await hashHarnessBootstrap(reordered),
    );
  });

  it('changes when a file content changes', async () => {
    const altered: HarnessV1Bootstrap = {
      ...baseRecipe,
      files: [
        { path: '/tmp/harness/demo/a.txt', content: 'one!' },
        baseRecipe.files[1],
      ],
    };
    expect(await hashHarnessBootstrap(altered)).not.toBe(
      await hashHarnessBootstrap(baseRecipe),
    );
  });

  it('changes when a command changes', async () => {
    const altered: HarnessV1Bootstrap = {
      ...baseRecipe,
      commands: [{ command: 'echo different' }],
    };
    expect(await hashHarnessBootstrap(altered)).not.toBe(
      await hashHarnessBootstrap(baseRecipe),
    );
  });

  it('changes when harnessId changes', async () => {
    const altered: HarnessV1Bootstrap = { ...baseRecipe, harnessId: 'other' };
    expect(await hashHarnessBootstrap(altered)).not.toBe(
      await hashHarnessBootstrap(baseRecipe),
    );
  });

  it('changes when bootstrapDir changes', async () => {
    const altered: HarnessV1Bootstrap = {
      ...baseRecipe,
      bootstrapDir: '/tmp/other',
    };
    expect(await hashHarnessBootstrap(altered)).not.toBe(
      await hashHarnessBootstrap(baseRecipe),
    );
  });
});

describe('bootstrapMarkerPath', () => {
  it('embeds the identity in the filename under bootstrapDir', () => {
    expect(bootstrapMarkerPath(baseRecipe, 'abc1234567890def')).toBe(
      '/tmp/harness/demo/.bootstrap-abc1234567890def.ok',
    );
  });
});

describe('applyBootstrapRecipe', () => {
  const identity = 'idtest1234567890';

  function makeMockSession(opts?: {
    markerExists?: boolean;
    commandExitCode?: number;
    runFailureMessage?: string;
  }): {
    session: SandboxSession;
    readTextFile: ReturnType<typeof vi.fn>;
    writeTextFile: ReturnType<typeof vi.fn>;
    run: ReturnType<typeof vi.fn>;
  } {
    const markerPath = bootstrapMarkerPath(baseRecipe, identity);
    const readTextFile = vi.fn(async (args: { path: string }) => {
      if (args.path === markerPath && opts?.markerExists) return '';
      return null;
    });
    const writeTextFile = vi.fn(async () => {});
    const run = vi.fn(async () => ({
      exitCode: opts?.commandExitCode ?? 0,
      stdout: 'ok',
      stderr: opts?.runFailureMessage ?? '',
    }));
    const session = {
      description: 'mock',
      readTextFile,
      writeTextFile,
      run,
    } as unknown as SandboxSession;
    return { session, readTextFile, writeTextFile, run };
  }

  it('skips when the marker file is present', async () => {
    const { session, readTextFile, writeTextFile, run } = makeMockSession({
      markerExists: true,
    });
    await applyBootstrapRecipe(session, baseRecipe, identity);
    expect(readTextFile).toHaveBeenCalledTimes(1);
    expect(writeTextFile).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });

  it('writes files, runs commands, and writes the marker on cold run', async () => {
    const { session, writeTextFile, run } = makeMockSession();
    await applyBootstrapRecipe(session, baseRecipe, identity);
    expect(writeTextFile).toHaveBeenCalledTimes(
      baseRecipe.files.length + 1, // recipe files + marker
    );
    expect(run).toHaveBeenCalledTimes(baseRecipe.commands.length);
    const lastWrite = writeTextFile.mock.calls.at(-1)![0];
    expect(lastWrite.path).toBe(bootstrapMarkerPath(baseRecipe, identity));
  });

  it('throws when a command exits non-zero and skips the marker write', async () => {
    const { session, writeTextFile, run } = makeMockSession({
      commandExitCode: 7,
      runFailureMessage: 'boom',
    });
    await expect(
      applyBootstrapRecipe(session, baseRecipe, identity),
    ).rejects.toThrow(/Bootstrap command failed.*exit 7.*boom/s);
    expect(run).toHaveBeenCalledTimes(1);
    const markerWrites = writeTextFile.mock.calls.filter(
      ([args]) => args.path === bootstrapMarkerPath(baseRecipe, identity),
    );
    expect(markerWrites).toHaveLength(0);
  });
});

describe('BOOTSTRAP_SCHEMA_VERSION', () => {
  it('is a positive integer', () => {
    expect(Number.isInteger(BOOTSTRAP_SCHEMA_VERSION)).toBe(true);
    expect(BOOTSTRAP_SCHEMA_VERSION).toBeGreaterThan(0);
  });
});
