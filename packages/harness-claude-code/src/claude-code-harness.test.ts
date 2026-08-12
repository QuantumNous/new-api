import {
  HarnessCapabilityUnsupportedError,
  type HarnessV1NetworkSandboxSession,
} from '@ai-sdk/harness';
import type * as HarnessUtils from '@ai-sdk/harness/utils';
import type * as NodeFsPromises from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sentMessages: Array<Record<string, unknown>> = [];
const openCalls: Array<{ resume?: boolean } | undefined> = [];

vi.mock('@ai-sdk/harness/utils', async importOriginal => {
  const actual = await importOriginal<typeof HarnessUtils>();
  class FakeSandboxChannel {
    async open(opts?: { resume?: boolean }): Promise<void> {
      openCalls.push(opts);
    }
    on(): () => void {
      return () => {};
    }
    onClose(): void {}
    send(msg: Record<string, unknown>): void {
      sentMessages.push(msg);
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

// eslint-disable-next-line import/first
import { createClaudeCode } from './claude-code-harness';

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

function fakeNetworkSandboxSessionForStartupFailure({
  stdout,
  stderr,
  exitCode = 1,
}: {
  stdout: string;
  stderr: string;
  exitCode?: number;
}): HarnessV1NetworkSandboxSession {
  const port = 4319;
  const session = {
    run: async () => ({ exitCode: 0, stdout: '', stderr: '' }),
    readTextFile: async () => null,
    spawn: async () => ({
      stdout: textStream(stdout),
      stderr: textStream(stderr),
      kill: async () => {},
      wait: async () => ({ exitCode }),
    }),
  };
  return {
    id: 'test-sandbox',
    defaultWorkingDirectory: '/vercel/sandbox',
    restricted: () => session,
    ports: [port],
    async getPortUrl() {
      return `ws://127.0.0.1:${port}`;
    },
    async stop() {},
    ...session,
  } as unknown as HarnessV1NetworkSandboxSession;
}

function fakeNetworkSandboxSessionForStartupSuccess({
  bridgePortUrl,
  spawns,
  spawnEnvs,
  writes,
  runs,
}: {
  bridgePortUrl: string;
  spawns?: string[];
  spawnEnvs?: Array<Record<string, string | undefined>>;
  writes: Array<{ path: string; content: string }>;
  runs: string[];
}): HarnessV1NetworkSandboxSession {
  const session = {
    run: async ({ command }: { command: string }) => {
      runs.push(command);
      if (command === 'printf "%s" "$HOME"') {
        return { exitCode: 0, stdout: '/home/vercel-sandbox', stderr: '' };
      }
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
      spawns?.push(command);
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

function lastStart(): Record<string, unknown> {
  const start = [...sentMessages].reverse().find(m => m.type === 'start');
  if (!start) throw new Error('no start message was sent');
  return start;
}

describe('createClaudeCode adapter', () => {
  beforeEach(() => {
    sentMessages.length = 0;
    openCalls.length = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('declares the harness id and builtin tools', () => {
    const harness = createClaudeCode();
    expect(harness.harnessId).toBe('claude-code');
    expect(harness.specificationVersion).toBe('harness-v1');
    expect(harness.supportsBuiltinToolApprovals).toBe(true);
    expect(harness.supportsBuiltinToolFiltering).toBe(true);
    expect(Object.keys(harness.builtinTools)).toEqual([
      'read',
      'write',
      'edit',
      'bash',
      'glob',
      'grep',
      'webSearch',
      'WebFetch',
      'NotebookEdit',
      'TodoWrite',
      'Agent',
      'TaskCreate',
      'TaskGet',
      'TaskUpdate',
      'TaskList',
      'TaskStop',
      'TaskOutput',
      'Monitor',
      'ListMcpResources',
      'ReadMcpResource',
      'ExitPlanMode',
      'EnterWorktree',
      'ExitWorktree',
      'AskUserQuestion',
      'Skill',
      'ToolSearch',
    ]);
    expect(harness.builtinTools.read.nativeName).toBe('Read');
    expect(harness.builtinTools.read.commonName).toBe('read');
    expect(harness.builtinTools.read.toolUseKind).toBe('readonly');
    expect(harness.builtinTools.write.toolUseKind).toBe('edit');
    expect(harness.builtinTools.bash.toolUseKind).toBe('bash');
    // WebFetch has no cross-harness common equivalent — its key is the
    // native name directly, so the entry intentionally omits both
    // `nativeName` and `commonName`.
    expect(harness.builtinTools.WebFetch).toBeDefined();
  });

  it('throws HarnessCapabilityUnsupportedError when the network sandbox session exposes no ports', async () => {
    const harness = createClaudeCode();
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
        sessionWorkDir: '/vercel/sandbox/claude-code-s1',
      }),
    ).rejects.toBeInstanceOf(HarnessCapabilityUnsupportedError);
  });

  it('quotes dynamic startup paths in shell commands', async () => {
    const runs: string[] = [];
    const spawns: string[] = [];
    const spawnEnvs: Array<Record<string, string | undefined>> = [];
    const writes: Array<{ path: string; content: string }> = [];
    const harness = createClaudeCode();
    const session = await harness.doStart({
      sessionId: 's1; env > /tmp/leak #',
      sandboxSession: fakeNetworkSandboxSessionForStartupSuccess({
        bridgePortUrl: 'ws://127.0.0.1:1',
        runs,
        spawns,
        spawnEnvs,
        writes,
      }),
      sessionWorkDir:
        '/vercel/sandbox/claude-code-s1; env > /tmp/workdir-leak #',
    });

    expect(runs).toContain(
      "mkdir -p '/vercel/sandbox/claude-code-s1; env > /tmp/workdir-leak #' '/vercel/sandbox/.agent-runs/s1; env > /tmp/leak #/bridge'",
    );
    expect(spawns).toEqual([
      "node /tmp/harness/claude-code/bridge.mjs --workdir '/vercel/sandbox/claude-code-s1; env > /tmp/workdir-leak #' --bridge-state-dir '/vercel/sandbox/.agent-runs/s1; env > /tmp/leak #/bridge'",
    ]);
    expect(spawnEnvs.at(0)?.CLAUDE_AGENT_SDK_CLIENT_APP).toBe(
      'ai-sdk/harness-claude-code/0.0.0-test',
    );
    await session.doDestroy();
  });

  it('sends the structured thinking configuration to the bridge', async () => {
    const thinking = { type: 'enabled' as const, display: 'omitted' as const };
    const harness = createClaudeCode({ thinking });
    const session = await harness.doStart({
      sessionId: 's1',
      sandboxSession: fakeNetworkSandboxSessionForStartupSuccess({
        bridgePortUrl: 'ws://127.0.0.1:1',
        writes: [],
        runs: [],
      }),
      sessionWorkDir: '/vercel/sandbox/claude-code-s1',
    });
    const control = await session.doPromptTurn({
      prompt: 'think about this',
      emit: () => {},
    });
    void Promise.resolve(control.done).catch(() => {});

    expect(lastStart()).toMatchObject({ thinking });

    await session.doDestroy();
  });

  it('defaults to summarized adaptive thinking', async () => {
    const harness = createClaudeCode();
    const session = await harness.doStart({
      sessionId: 's1',
      sandboxSession: fakeNetworkSandboxSessionForStartupSuccess({
        bridgePortUrl: 'ws://127.0.0.1:1',
        writes: [],
        runs: [],
      }),
      sessionWorkDir: '/vercel/sandbox/claude-code-s1',
    });
    const control = await session.doPromptTurn({
      prompt: 'think about this',
      emit: () => {},
    });
    void Promise.resolve(control.done).catch(() => {});

    expect(lastStart()).toMatchObject({
      thinking: { type: 'adaptive', display: 'summarized' },
    });

    await session.doDestroy();
  });

  it('writes standard Claude skill files and enables their names on start', async () => {
    const writes: Array<{ path: string; content: string }> = [];
    const runs: string[] = [];
    const harness = createClaudeCode();
    const session = await harness.doStart({
      sessionId: 's1',
      sandboxSession: fakeNetworkSandboxSessionForStartupSuccess({
        bridgePortUrl: 'ws://127.0.0.1:1',
        writes,
        runs,
      }),
      sessionWorkDir: '/vercel/sandbox/claude-code-s1',
      skills: [
        {
          name: 'weather-forecast',
          description: 'Use the weather forecast tool.',
          content: 'Call `get_weather` before answering forecasts.',
          files: [
            {
              path: 'reference.md',
              content: '# Forecast reference',
            },
          ],
        },
        {
          name: 'weather-codes',
          description: 'Read weather code reference.',
          content: 'Read `weather-codes.md` for code descriptions.',
        },
      ],
    });
    const control = await session.doPromptTurn({
      prompt: 'which skills do you have available?',
      emit: () => {},
    });
    void Promise.resolve(control.done).catch(() => {});

    expect(lastStart()).toMatchObject({
      skills: ['weather-forecast', 'weather-codes'],
    });

    const skillWrites = writes.filter(
      write => !write.path.endsWith('/bridge-meta.json'),
    );
    const bridgeMetaWrite = writes.find(write =>
      write.path.endsWith('/bridge-meta.json'),
    );
    expect(runs).toContain("mkdir -p '/home/vercel-sandbox/.claude/skills'");
    expect(bridgeMetaWrite).toEqual({
      path: '/vercel/sandbox/.agent-runs/s1/bridge/bridge-meta.json',
      content: JSON.stringify({ type: 'claude-code', state: 'starting' }),
    });
    expect(skillWrites.map(write => write.path)).toEqual([
      '/home/vercel-sandbox/.claude/skills/weather-forecast/SKILL.md',
      '/home/vercel-sandbox/.claude/skills/weather-forecast/reference.md',
      '/home/vercel-sandbox/.claude/skills/weather-codes/SKILL.md',
    ]);
    expect(skillWrites[0].content).toContain('name: weather-forecast');
    expect(skillWrites[1].content).toBe('# Forecast reference');
    await session.doDestroy();
  });

  it('rejects unsafe skill names before writing skill files', async () => {
    const writes: Array<{ path: string; content: string }> = [];
    const harness = createClaudeCode();

    await expect(
      harness.doStart({
        sessionId: 's1',
        sandboxSession: fakeNetworkSandboxSessionForStartupSuccess({
          bridgePortUrl: 'ws://127.0.0.1:1',
          writes,
          runs: [],
        }),
        sessionWorkDir: '/vercel/sandbox/claude-code-s1',
        skills: [
          {
            name: '../weather',
            description: 'unsafe',
            content: 'unsafe',
          },
        ],
      }),
    ).rejects.toThrow('Invalid Claude Code skill name');
    expect(writes).toEqual([]);
  });

  it('rejects unsafe skill file paths before writing skill files', async () => {
    const writes: Array<{ path: string; content: string }> = [];
    const runs: string[] = [];
    const harness = createClaudeCode();

    await expect(
      harness.doStart({
        sessionId: 's1',
        sandboxSession: fakeNetworkSandboxSessionForStartupSuccess({
          bridgePortUrl: 'ws://127.0.0.1:1',
          writes,
          runs,
        }),
        sessionWorkDir: '/vercel/sandbox/claude-code-s1',
        skills: [
          {
            name: 'weather',
            description: 'unsafe',
            content: 'unsafe',
            files: [{ path: '../weather-codes.md', content: 'unsafe' }],
          },
        ],
      }),
    ).rejects.toThrow('Invalid Claude Code skill file path');
    expect(writes).toEqual([]);
    expect(runs).not.toContain(
      "mkdir -p '/home/vercel-sandbox/.claude/skills'",
    );
  });

  it('includes bridge startup stdout, stderr, and exit code when ready never arrives', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const harness = createClaudeCode();
    const stdout =
      JSON.stringify({
        type: 'bridge-fatal',
        message: 'Missing --workdir argument.',
      }) + '\n';
    const sandboxSession = fakeNetworkSandboxSessionForStartupFailure({
      stdout,
      stderr: 'Cannot find module @anthropic-ai/claude-agent-sdk',
      exitCode: 1,
    });

    let error: unknown;
    try {
      await harness.doStart({
        sessionId: 's1',
        sandboxSession,
        sessionWorkDir: '/vercel/sandbox/claude-code-s1',
      });
    } catch (err) {
      error = err;
    }

    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).toContain(
      'claude-code bridge exited before becoming ready.',
    );
    expect(message).toContain('Exit code: 1.');
    expect(message).toContain('bridge-fatal');
    expect(message).toContain('Missing --workdir argument.');
    expect(message).toContain(
      'Cannot find module @anthropic-ai/claude-agent-sdk',
    );
  });

  describe('getBootstrap', () => {
    it('returns a recipe with the expected harnessId and bootstrapDir', async () => {
      const harness = createClaudeCode();
      expect(harness.getBootstrap).toBeDefined();
      const recipe = await harness.getBootstrap!();
      expect(recipe.harnessId).toBe('claude-code');
      expect(recipe.bootstrapDir).toBe('/tmp/harness/claude-code');
    });

    it('includes bridge.mjs, package.json, and pnpm-lock.yaml under the bootstrap dir', async () => {
      const harness = createClaudeCode();
      const recipe = await harness.getBootstrap!();
      const paths = recipe.files.map(f => f.path).sort();
      expect(paths).toEqual([
        '/tmp/harness/claude-code/bridge.mjs',
        '/tmp/harness/claude-code/package.json',
        '/tmp/harness/claude-code/pnpm-lock.yaml',
      ]);
      for (const file of recipe.files) {
        expect(file.content.length).toBeGreaterThan(0);
      }
    });

    it('declares mkdir, pnpm install, and claude post-install commands', async () => {
      const harness = createClaudeCode();
      const recipe = await harness.getBootstrap!();
      const commands = recipe.commands.map(c => c.command);
      expect(commands[0]).toContain('mkdir -p /tmp/harness/claude-code');
      expect(commands[1]).toContain('pnpm');
      expect(commands[1]).toContain('install --frozen-lockfile');
      expect(commands[2]).toContain('claude --version');
    });

    it('caches the recipe across calls', async () => {
      const harness = createClaudeCode();
      const a = await harness.getBootstrap!();
      const b = await harness.getBootstrap!();
      expect(a).toBe(b);
    });
  });
});
