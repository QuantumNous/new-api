import type { HarnessV1NetworkSandboxSession } from '@ai-sdk/harness';
import type * as HarnessUtils from '@ai-sdk/harness/utils';
import type * as NodeFsPromises from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { createDeepAgents } from './deepagents-harness';

// Captures the wireTurn `onClose` handler so tests can fire a close with a chosen reason.
const closeHolder: { fire?: (code: number, reason: string) => void } = {};

vi.mock('@ai-sdk/harness/utils', async importOriginal => {
  const actual = await importOriginal<typeof HarnessUtils>();
  class FakeSandboxChannel {
    async open(): Promise<void> {}
    on(): () => void {
      return () => {};
    }
    onClose(handler: (code: number, reason: string) => void): void {
      closeHolder.fire = handler;
    }
    send(): void {}
    suspend(): Promise<number> {
      return Promise.resolve(0);
    }
    beginClose(): void {}
    isClosed(): boolean {
      return false;
    }
    close(): void {}
  }
  return { ...actual, SandboxChannel: FakeSandboxChannel };
});

vi.mock('node:fs/promises', async importOriginal => {
  const actual = await importOriginal<typeof NodeFsPromises>();
  return {
    ...actual,
    readFile: vi.fn(async (input: unknown, ...rest: unknown[]) => {
      const path = typeof input === 'string' ? input : String(input);
      if (path.endsWith('/bridge/index.mjs')) return '// mock bridge\n';
      if (path.endsWith('/bridge/package.json')) return '{"name":"mock"}';
      if (path.endsWith('/bridge/pnpm-lock.yaml'))
        return 'lockfileVersion: "9.0"\n';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (actual.readFile as any)(input, ...rest);
    }),
  };
});

function textStream(text: string): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      if (text.length > 0) controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
}

function fakeSandboxSession({
  spawnEnvs,
}: {
  spawnEnvs?: Array<Record<string, string | undefined>>;
} = {}): HarnessV1NetworkSandboxSession {
  const session = {
    run: async () => ({ exitCode: 0, stdout: '', stderr: '' }),
    readTextFile: async () => null,
    writeTextFile: async () => {},
    spawn: async ({
      env,
    }: {
      env?: Record<string, string | undefined>;
    } = {}) => {
      if (env) spawnEnvs?.push(env);
      return {
        stdout: textStream('{"type":"bridge-ready","port":4319}\n'),
        stderr: textStream(''),
        kill: async () => {},
        wait: async () => ({ exitCode: 0 }),
      };
    },
  };
  return {
    id: 'test-sandbox',
    defaultWorkingDirectory: '/vercel/sandbox',
    restricted: () => session,
    ports: [4319],
    async getPortUrl() {
      return 'ws://127.0.0.1:4319';
    },
    async stop() {},
    ...session,
  } as unknown as HarnessV1NetworkSandboxSession;
}

async function startTurn() {
  closeHolder.fire = undefined;
  const harness = createDeepAgents();
  const session = await harness.doStart({
    sessionId: 'test-session',
    sessionWorkDir: '/vercel/sandbox/deepagents-test-session',
    sandboxSession: fakeSandboxSession(),
  } as unknown as Parameters<typeof harness.doStart>[0]);
  const control = await session.doPromptTurn({
    prompt: 'hi',
    emit: () => {},
  } as unknown as Parameters<typeof session.doPromptTurn>[0]);
  return control;
}

describe('createDeepAgents', () => {
  it('reports the harness-v1 metadata', () => {
    const harness = createDeepAgents();
    expect(harness.specificationVersion).toBe('harness-v1');
    expect(harness.harnessId).toBe('deepagents');
    expect(harness.supportsBuiltinToolApprovals).toBe(true);
    expect(harness.supportsBuiltinToolFiltering).toBeUndefined();
  });

  it('ships the node bridge files and a pnpm install command in its bootstrap', async () => {
    const harness = createDeepAgents();
    const bootstrap = await harness.getBootstrap!();
    expect(bootstrap.harnessId).toBe('deepagents');
    const paths = bootstrap.files.map(f => f.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        expect.stringContaining('bridge.mjs'),
        expect.stringContaining('package.json'),
        expect.stringContaining('pnpm-lock.yaml'),
      ]),
    );
    const commands = bootstrap.commands.map(c => c.command).join('\n');
    expect(commands).toContain('pnpm');
    expect(commands).toContain('install');
  });

  it('caches the bootstrap across calls', async () => {
    const harness = createDeepAgents();
    const a = await harness.getBootstrap!();
    const b = await harness.getBootstrap!();
    expect(a).toBe(b);
  });

  it('exposes a lifecycle state schema for resume payloads', () => {
    const harness = createDeepAgents();
    expect(harness.lifecycleStateSchema).toBeDefined();
  });

  it('passes the harness client app to the bridge environment', async () => {
    const spawnEnvs: Array<Record<string, string | undefined>> = [];
    const harness = createDeepAgents();
    const session = await harness.doStart({
      sessionId: 'test-session',
      sessionWorkDir: '/vercel/sandbox/deepagents-test-session',
      sandboxSession: fakeSandboxSession({ spawnEnvs }),
    } as unknown as Parameters<typeof harness.doStart>[0]);

    expect(spawnEnvs.at(0)?.AI_SDK_HARNESS_CLIENT_APP).toBe(
      'ai-sdk/harness-deepagents/0.0.0-test',
    );

    await session.doDestroy();
  });

  it('resolves the turn when the channel closes with reason "suspended"', async () => {
    const control = await startTurn();
    closeHolder.fire?.(1000, 'suspended');
    await expect(control.done).resolves.toBeUndefined();
  });

  it('rejects the turn when the channel closes for any other reason', async () => {
    const control = await startTurn();
    closeHolder.fire?.(1006, 'reconnect failed');
    await expect(control.done).rejects.toThrow(
      'deepagents bridge closed before the turn finished',
    );
  });
});
