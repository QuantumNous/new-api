import type {
  HarnessV1ContinueTurnState,
  HarnessV1NetworkSandboxSession,
  HarnessV1ResumeSessionState,
  HarnessV1Session,
} from '@ai-sdk/harness';
import type * as HarnessUtils from '@ai-sdk/harness/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * The claude-code adapter prepends `instructions` to the user text it puts in
 * the `start` message's `prompt`. We stub `SandboxChannel` so `send()` records
 * the messages instead of opening a real WebSocket, then drive `doStart` →
 * `doPromptTurn` against a fake network sandbox session. This isolates the
 * "prepend to the first user message only" gating without standing up the
 * in-sandbox bridge.
 */
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

// eslint-disable-next-line import/first
import { createClaudeCode } from './claude-code-harness';

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
  const port = 4319;
  const session = {
    run: async () => ({ exitCode: 0, stdout: '', stderr: '' }),
    readTextFile: async () => null,
    spawn: async () => ({
      stdout: readyStream(port),
      stderr: emptyStream(),
      kill: async () => {},
      wait: async () => ({ exitCode: 0 }),
    }),
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
}): Promise<HarnessV1Session> {
  const harness = createClaudeCode();
  return harness.doStart({
    sessionId: 's1',
    sandboxSession: fakeNetworkSandboxSession(),
    sessionWorkDir: '/wd/claude-code-s1',
    ...(options?.resumeFrom ? { resumeFrom: options.resumeFrom } : {}),
    ...(options?.continueFrom ? { continueFrom: options.continueFrom } : {}),
  });
}

function lastStart(): Record<string, unknown> {
  const start = [...sentMessages].reverse().find(m => m.type === 'start');
  if (!start) throw new Error('no start message was sent');
  return start;
}

const INSTRUCTIONS = 'Use turbo build --concurrency=4.';

describe('claude-code adapter — instructions gating', () => {
  beforeEach(() => {
    sentMessages.length = 0;
    openCalls.length = 0;
  });

  it('frames instructions into the first user message only', async () => {
    const session = await startSession();

    await session.doPromptTurn({
      prompt: 'first turn',
      instructions: INSTRUCTIONS,
      emit: () => {},
    });
    const framed = lastStart().prompt as string;
    expect(framed).toContain('<session-instructions>');
    expect(framed).toContain(INSTRUCTIONS);
    expect(framed).toContain('<user-message>\nfirst turn\n</user-message>');
    // The instructions must be marked as system guidance, not user-authored.
    expect(framed).toMatch(/not a message from the user/i);

    await session.doPromptTurn({
      prompt: 'second turn',
      instructions: INSTRUCTIONS,
      emit: () => {},
    });
    expect(lastStart().prompt).toBe('second turn');
  });

  it('does not apply instructions when resuming a session', async () => {
    const session = await startSession({
      resumeFrom: {
        type: 'resume-session',
        harnessId: 'claude-code',
        specificationVersion: 'harness-v1',
        data: {},
      },
    });

    await session.doPromptTurn({
      prompt: 'resumed turn',
      instructions: INSTRUCTIONS,
      emit: () => {},
    });
    expect(lastStart().prompt).toBe('resumed turn');
  });

  it('distinguishes parked session resume from suspended turn continuation', async () => {
    await startSession({
      resumeFrom: {
        type: 'resume-session',
        harnessId: 'claude-code',
        specificationVersion: 'harness-v1',
        data: {
          bridge: {
            port: 4319,
            token: 'token',
            lastSeenEventId: 7,
          },
        },
      },
    });
    expect(openCalls.at(-1)).toBeUndefined();

    await startSession({
      continueFrom: {
        type: 'continue-turn',
        harnessId: 'claude-code',
        specificationVersion: 'harness-v1',
        data: {
          bridge: {
            port: 4319,
            token: 'token',
            lastSeenEventId: 7,
          },
        },
      },
    });
    expect(openCalls.at(-1)).toEqual({ resume: true });
  });
});
