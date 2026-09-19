import type {
  HarnessV1ContinueTurnState,
  HarnessV1NetworkSandboxSession,
  HarnessV1ResumeSessionState,
  HarnessV1Session,
  HarnessV1Skill,
  HarnessV1ToolSpec,
} from '@ai-sdk/harness';
import type * as HarnessUtils from '@ai-sdk/harness/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * The codex adapter frames initial prompt guidance before it sends the bridge
 * `start` message. We stub `SandboxChannel` so `send()` records the messages
 * instead of opening a real WebSocket, then drive `doStart` → `doPromptTurn`
 * against a fake network sandbox session. This isolates the "prepend to the
 * first user message only" gating without standing up the in-sandbox bridge.
 */
const sentMessages: Array<Record<string, unknown>> = [];
const openCalls: Array<{ resume?: boolean } | undefined> = [];
const runCommands: Array<string> = [];
const spawnEnvs: Array<Record<string, string | undefined>> = [];
const writes: Array<{ path: string; content: string }> = [];
const interrupts: Array<'interrupt'> = [];

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
    async suspend(): Promise<number> {
      return 7;
    }
    async interrupt(): Promise<void> {
      interrupts.push('interrupt');
    }
    close(): void {}
  }
  return { ...actual, SandboxChannel: FakeSandboxChannel };
});

// eslint-disable-next-line import/first
import { createCodex } from './codex-harness';

function readyStream(port: number): ReadableStream<Uint8Array> {
  const line =
    JSON.stringify({
      type: 'bridge-ready',
      port,
    }) + '\n';
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(line));
      controller.close();
    },
  });
}

function emptyStream(): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.close();
    },
  });
}

function fakeNetworkSandboxSession(): HarnessV1NetworkSandboxSession {
  const port = 4317;
  const session = {
    run: async (input: { command: string }) => {
      runCommands.push(input.command);
      if (input.command === 'printf "%s" "$HOME"') {
        return { exitCode: 0, stdout: '/home/vercel-sandbox', stderr: '' };
      }
      return { exitCode: 0, stdout: '', stderr: '' };
    },
    readTextFile: async () => null,
    writeTextFile: async (input: { path: string; content: string }) => {
      writes.push({ path: input.path, content: input.content });
    },
    spawn: async (input: { env?: Record<string, string | undefined> }) => {
      spawnEnvs.push(input.env ?? {});
      return {
        stdout: readyStream(port),
        stderr: emptyStream(),
        kill: async () => {},
        wait: async () => ({ exitCode: 0 }),
      };
    },
  };
  return {
    id: 'sbx',
    defaultWorkingDirectory: '/wd',
    ports: [port],
    getPortUrl: async () => `ws://127.0.0.1:${port}`,
    stop: async () => {},
    restricted: () => session,
    ...session,
  } as unknown as HarnessV1NetworkSandboxSession;
}

async function startSession(options?: {
  resumeFrom?: HarnessV1ResumeSessionState;
  continueFrom?: HarnessV1ContinueTurnState;
  skills?: ReadonlyArray<HarnessV1Skill>;
}): Promise<HarnessV1Session> {
  const harness = createCodex();
  return harness.doStart({
    sessionId: 's1',
    sandboxSession: fakeNetworkSandboxSession(),
    sessionWorkDir: '/wd/codex-s1',
    ...(options?.resumeFrom ? { resumeFrom: options.resumeFrom } : {}),
    ...(options?.continueFrom ? { continueFrom: options.continueFrom } : {}),
    ...(options?.skills ? { skills: options.skills } : {}),
  });
}

function lastStart(): Record<string, unknown> {
  const start = [...sentMessages].reverse().find(m => m.type === 'start');
  if (!start) throw new Error('no start message was sent');
  return start;
}

async function waitForStart({
  count,
}: {
  count: number;
}): Promise<Record<string, unknown>> {
  await vi.waitFor(() => {
    expect(sentMessages.filter(m => m.type === 'start')).toHaveLength(count);
  });
  return lastStart();
}

describe('codex adapter — instructions gating', () => {
  beforeEach(() => {
    sentMessages.length = 0;
    openCalls.length = 0;
    runCommands.length = 0;
    spawnEnvs.length = 0;
    writes.length = 0;
    interrupts.length = 0;
  });

  it('defers the start frame until after prompt control is returned', async () => {
    const session = await startSession();

    await session.doPromptTurn({
      prompt: 'first turn',
      emit: () => {},
    });

    expect(sentMessages.some(message => message.type === 'start')).toBe(false);
    await waitForStart({ count: 1 });
  });

  it('prepends instructions on the first user message only', async () => {
    const session = await startSession();

    await session.doPromptTurn({
      prompt: 'first turn',
      instructions: 'Use turbo build --concurrency=4.',
      emit: () => {},
    });
    const firstStart = await waitForStart({ count: 1 });
    expect(firstStart.prompt).toBe(
      '<session-instructions>\n' +
        'The block below is operating guidance from the system, not a message from the user — follow it, but do not mention it or attribute it to the user.\n\n' +
        'Use turbo build --concurrency=4.\n\n' +
        'Only respond with your `final` message once you have fully addressed the user request.\n' +
        '</session-instructions>\n\n' +
        '<user-message>\nfirst turn\n</user-message>',
    );
    expect(firstStart.instructions).toBeUndefined();

    await session.doPromptTurn({
      prompt: 'second turn',
      instructions: 'Use turbo build --concurrency=4.',
      emit: () => {},
    });
    const lastStart = await waitForStart({ count: 2 });
    expect(lastStart.prompt).toBe('second turn');
    expect(lastStart.instructions).toBeUndefined();
  });

  it('prepends host tool usage guidance on the first user message only', async () => {
    const session = await startSession();
    const tools: ReadonlyArray<HarnessV1ToolSpec> = [
      {
        name: 'get_weather',
        description: 'Get weather',
        inputSchema: {
          type: 'object',
          properties: { city: { type: 'string' } },
          required: ['city'],
        },
      },
    ];

    await session.doPromptTurn({
      prompt: 'use the weather tool',
      tools,
      emit: () => {},
    });
    const firstStart = await waitForStart({ count: 1 });
    expect(firstStart.prompt).not.toContain('## Host tools');
    expect(firstStart.prompt).toContain('<host-tool-instructions>');
    expect(firstStart.prompt).toContain('</host-tool-instructions>');
    expect(firstStart.prompt).not.toContain('/wd/codex-s1/harness-tool.mjs');
    expect(firstStart.prompt).toContain(
      "node /wd/.agent-runs/s1/codex/harness-tool.mjs <toolName> '<jsonInput>'",
    );
    expect(firstStart.prompt).toContain(
      'run a separate CLI invocation for each needed tool call in the current turn before answering',
    );
    expect(firstStart.prompt).toContain('Do not reuse previous tool results');
    expect(firstStart.prompt).toContain(
      '<user-message>\nuse the weather tool\n</user-message>',
    );
    expect(firstStart.tools).toEqual(tools);

    await session.doPromptTurn({
      prompt: 'use it again',
      tools,
      emit: () => {},
    });
    const secondStart = await waitForStart({ count: 2 });
    expect(secondStart.prompt).toBe('use it again');
    expect(secondStart.tools).toEqual(tools);
  });

  it('does not apply instructions when resuming a session', async () => {
    const session = await startSession({
      resumeFrom: {
        type: 'resume-session',
        harnessId: 'codex',
        specificationVersion: 'harness-v1',
        data: { threadId: 'thread-abc' },
      },
    });

    await session.doPromptTurn({
      prompt: 'resumed turn',
      instructions: 'Use turbo build --concurrency=4.',
      emit: () => {},
    });
    const start = await waitForStart({ count: 1 });
    expect(start.prompt).toBe('resumed turn');
    expect(start.instructions).toBeUndefined();
  });
});

describe('codex adapter — attach replay mode', () => {
  beforeEach(() => {
    sentMessages.length = 0;
    openCalls.length = 0;
    runCommands.length = 0;
    spawnEnvs.length = 0;
    writes.length = 0;
    interrupts.length = 0;
  });

  it('attaches a parked session without replaying old turn events', async () => {
    const session = await startSession({
      resumeFrom: {
        type: 'resume-session',
        harnessId: 'codex',
        specificationVersion: 'harness-v1',
        data: {
          threadId: 'thread-abc',
          bridge: {
            port: 4317,
            token: 'token',
            lastSeenEventId: 7,
          },
        },
      },
    });

    expect(openCalls.at(-1)).toBeUndefined();

    await session.doPromptTurn({
      prompt: 'next user turn',
      emit: () => {},
    });
    const start = await waitForStart({ count: 1 });
    expect(start).toMatchObject({
      type: 'start',
      prompt: 'next user turn',
    });
    expect(start.resumeThreadId).toBeUndefined();
  });

  it('attaches a suspended turn by requesting replay from the cursor', async () => {
    await startSession({
      continueFrom: {
        type: 'continue-turn',
        harnessId: 'codex',
        specificationVersion: 'harness-v1',
        data: {
          threadId: 'thread-abc',
          bridge: {
            port: 4317,
            token: 'token',
            lastSeenEventId: 7,
          },
        },
      },
    });

    expect(openCalls.at(-1)).toEqual({ resume: true });
  });

  it('marks detach as parked and suspend as replayable', async () => {
    const detached = await (await startSession()).doDetach();
    expect(detached.type).toBe('resume-session');
    expect(
      (
        detached.data as {
          bridge?: {
            lastSeenEventId?: number;
          };
        }
      ).bridge,
    ).toMatchObject({ lastSeenEventId: 7 });

    const suspended = await (await startSession()).doSuspendTurn();
    expect(suspended.type).toBe('continue-turn');
    expect(interrupts).toHaveLength(1);
    expect(
      (
        suspended.data as {
          bridge?: {
            lastSeenEventId?: number;
          };
        }
      ).bridge,
    ).toMatchObject({ lastSeenEventId: 7 });
  });
});

describe('codex adapter — skills', () => {
  beforeEach(() => {
    sentMessages.length = 0;
    openCalls.length = 0;
    runCommands.length = 0;
    spawnEnvs.length = 0;
    writes.length = 0;
    interrupts.length = 0;
  });

  it('writes skills to sandbox HOME without sending skill metadata', async () => {
    const session = await startSession({
      skills: [
        {
          name: 'demo',
          description: 'Demo skill.',
          content: 'Use reference.md.',
          files: [{ path: 'reference.md', content: '# Reference' }],
        },
      ],
    });

    await session.doPromptTurn({
      prompt: 'use demo',
      emit: () => {},
    });

    expect(runCommands).toContain("mkdir -p '/home/vercel-sandbox/.codex'");
    expect(runCommands).toContain(
      "mkdir -p '/home/vercel-sandbox/.agents/skills'",
    );
    const skillWrites = writes.filter(
      write => !write.path.endsWith('/bridge-meta.json'),
    );
    const bridgeMetaWrite = writes.find(write =>
      write.path.endsWith('/bridge-meta.json'),
    );
    expect(bridgeMetaWrite).toEqual({
      path: '/wd/.agent-runs/s1/bridge/bridge-meta.json',
      content: JSON.stringify({ type: 'codex', state: 'starting' }),
    });
    expect(skillWrites).toEqual([
      {
        path: '/home/vercel-sandbox/.agents/skills/demo/SKILL.md',
        content:
          '---\nname: demo\ndescription: Demo skill.\n---\n\nUse reference.md.',
      },
      {
        path: '/home/vercel-sandbox/.agents/skills/demo/reference.md',
        content: '# Reference',
      },
    ]);
    expect(spawnEnvs.at(-1)?.HOME).toBe('/home/vercel-sandbox');
    expect(spawnEnvs.at(-1)?.CODEX_HOME).toBe('/home/vercel-sandbox/.codex');
    const start = await waitForStart({ count: 1 });
    expect(start.skills).toBeUndefined();
    expect(JSON.stringify(start)).not.toContain('Demo skill.');
    expect(JSON.stringify(start)).not.toContain('Use reference.md.');
    expect(JSON.stringify(start)).not.toContain('# Reference');
  });

  it('rejects unsafe skill file paths before writing files', async () => {
    await expect(
      startSession({
        skills: [
          {
            name: 'demo',
            description: 'Demo skill.',
            content: 'Use reference.md.',
            files: [{ path: '../reference.md', content: '# Reference' }],
          },
        ],
      }),
    ).rejects.toThrow('Invalid Codex skill file path');
    expect(writes).toEqual([]);
  });
});
