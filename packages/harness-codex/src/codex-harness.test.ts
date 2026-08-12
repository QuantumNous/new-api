import {
  HarnessCapabilityUnsupportedError,
  type HarnessV1NetworkSandboxSession,
} from '@ai-sdk/harness';
import type * as HarnessUtils from '@ai-sdk/harness/utils';
import type * as NodeFsPromises from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { createCodex } from './codex-harness';

vi.mock('@ai-sdk/harness/utils', async importOriginal => {
  const actual = await importOriginal<typeof HarnessUtils>();
  class FakeSandboxChannel {
    async open(): Promise<void> {}
    on(): () => void {
      return () => {};
    }
    onClose(): void {}
    send(): void {}
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
      if (path.endsWith('/bridge/host-tool-mcp.mjs'))
        return '// mock host-tool-mcp\n';
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
      if (text.length > 0) {
        controller.enqueue(new TextEncoder().encode(text));
      }
      controller.close();
    },
  });
}

function fakeNetworkSandboxSessionForStartupSuccess({
  bridgePortUrl,
  runs,
  spawns,
  spawnEnvs,
  writes,
}: {
  bridgePortUrl: string;
  runs: string[];
  spawns: string[];
  spawnEnvs?: Array<Record<string, string | undefined>>;
  writes: Array<{ path: string; content: string }>;
}): HarnessV1NetworkSandboxSession {
  const session = {
    run: async ({ command }: { command: string }) => {
      runs.push(command);
      return { exitCode: 0, stdout: '', stderr: '' };
    },
    readTextFile: async () => null,
    writeTextFile: async ({
      path,
      content,
    }: {
      path: string;
      content: string;
    }) => {
      writes.push({ path, content });
    },
    spawn: async ({
      command,
      env,
    }: {
      command: string;
      env?: Record<string, string | undefined>;
    }) => {
      spawns.push(command);
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
      return bridgePortUrl;
    },
    async stop() {},
    ...session,
  } as unknown as HarnessV1NetworkSandboxSession;
}

describe('createCodex adapter', () => {
  it('declares the harness id and builtin tools', () => {
    const harness = createCodex();
    expect(harness.harnessId).toBe('codex');
    expect(harness.specificationVersion).toBe('harness-v1');
    expect(harness.supportsBuiltinToolApprovals).toBe(false);
    expect(Object.keys(harness.builtinTools)).toEqual(['bash', 'webSearch']);
    expect(harness.builtinTools.bash.nativeName).toBe('shell');
    expect(harness.builtinTools.bash.commonName).toBe('bash');
    expect(harness.builtinTools.webSearch.nativeName).toBe('web_search');
    expect(harness.builtinTools.webSearch.commonName).toBe('webSearch');
  });

  it('rejects built-in permission modes other than allow-all', async () => {
    const harness = createCodex();
    await expect(
      harness.doStart({
        sessionId: 's1',
        sandboxSession: {} as HarnessV1NetworkSandboxSession,
        sessionWorkDir: '/vercel/sandbox/codex-s1',
        permissionMode: 'allow-edits',
      }),
    ).rejects.toBeInstanceOf(HarnessCapabilityUnsupportedError);
  });

  it('rejects built-in tool filtering controls', async () => {
    const harness = createCodex();
    await expect(
      harness.doStart({
        sessionId: 's1',
        sandboxSession: {} as HarnessV1NetworkSandboxSession,
        sessionWorkDir: '/vercel/sandbox/codex-s1',
        builtinToolFiltering: { mode: 'deny', toolNames: ['bash'] },
      }),
    ).rejects.toBeInstanceOf(HarnessCapabilityUnsupportedError);
  });

  it('throws HarnessCapabilityUnsupportedError when the network sandbox session exposes no ports', async () => {
    const harness = createCodex();
    const sandboxSession = {
      id: 'test-sandbox',
      defaultWorkingDirectory: '/vercel/sandbox',
      restricted: () => ({}) as never,
      ports: [] as ReadonlyArray<number>,
      async getPortUrl() {
        return '';
      },
      async stop() {},
    } as unknown as HarnessV1NetworkSandboxSession;
    await expect(
      harness.doStart({
        sessionId: 's1',
        sandboxSession,
        sessionWorkDir: '/vercel/sandbox/codex-s1',
      }),
    ).rejects.toBeInstanceOf(HarnessCapabilityUnsupportedError);
  });

  it('quotes dynamic startup paths in shell commands', async () => {
    const runs: string[] = [];
    const spawns: string[] = [];
    const spawnEnvs: Array<Record<string, string | undefined>> = [];
    const writes: Array<{ path: string; content: string }> = [];
    const harness = createCodex();
    const session = await harness.doStart({
      sessionId: 's1; env > /tmp/leak #',
      sandboxSession: fakeNetworkSandboxSessionForStartupSuccess({
        bridgePortUrl: 'ws://127.0.0.1:1',
        runs,
        spawns,
        spawnEnvs,
        writes,
      }),
      sessionWorkDir: '/vercel/sandbox/codex-s1; env > /tmp/workdir-leak #',
    });

    expect(runs).toContain(
      "mkdir -p '/vercel/sandbox/codex-s1; env > /tmp/workdir-leak #' '/vercel/sandbox/.agent-runs/s1; env > /tmp/leak #/bridge'",
    );
    expect(spawns).toEqual([
      "node /tmp/harness/codex/bridge.mjs --workdir '/vercel/sandbox/codex-s1; env > /tmp/workdir-leak #' --bridge-state-dir '/vercel/sandbox/.agent-runs/s1; env > /tmp/leak #/bridge' --bootstrap-dir '/tmp/harness/codex' --cli-shim-dir '/vercel/sandbox/.agent-runs/s1; env > /tmp/leak #/codex'",
    ]);
    expect(spawnEnvs.at(0)?.AI_SDK_HARNESS_CLIENT_APP).toBe(
      'ai-sdk/harness-codex/0.0.0-test',
    );
    await session.doDestroy();
  });

  describe('getBootstrap', () => {
    it('returns a recipe with the expected harnessId and bootstrapDir', async () => {
      const harness = createCodex();
      expect(harness.getBootstrap).toBeDefined();
      const recipe = await harness.getBootstrap!();
      expect(recipe.harnessId).toBe('codex');
      expect(recipe.bootstrapDir).toBe('/tmp/harness/codex');
    });

    it('includes bridge.mjs, host-tool-mcp.mjs, package.json, and pnpm-lock.yaml under the bootstrap dir', async () => {
      const harness = createCodex();
      const recipe = await harness.getBootstrap!();
      const paths = recipe.files.map(f => f.path).sort();
      expect(paths).toEqual([
        '/tmp/harness/codex/bridge.mjs',
        '/tmp/harness/codex/host-tool-mcp.mjs',
        '/tmp/harness/codex/package.json',
        '/tmp/harness/codex/pnpm-lock.yaml',
      ]);
      for (const file of recipe.files) {
        expect(file.content.length).toBeGreaterThan(0);
      }
    });

    it('declares mkdir and pnpm install commands', async () => {
      const harness = createCodex();
      const recipe = await harness.getBootstrap!();
      const commands = recipe.commands.map(c => c.command);
      expect(commands[0]).toContain('mkdir -p /tmp/harness/codex');
      expect(commands[1]).toContain('pnpm');
      expect(commands[1]).toContain('install --frozen-lockfile');
    });

    it('caches the recipe across calls', async () => {
      const harness = createCodex();
      const a = await harness.getBootstrap!();
      const b = await harness.getBootstrap!();
      expect(a).toBe(b);
    });
  });
});
