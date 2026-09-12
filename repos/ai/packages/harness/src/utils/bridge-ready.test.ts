import type {
  Experimental_SandboxProcess,
  Experimental_SandboxSession,
} from '@ai-sdk/provider-utils';
import { describe, expect, it, vi } from 'vitest';
import { markBridgeStarting, waitForBridgeReady } from './bridge-ready';

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

function pendingStream(): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>();
}

function makeProcess({
  stdout,
}: {
  stdout: ReadableStream<Uint8Array>;
}): Experimental_SandboxProcess {
  return {
    stdout,
    stderr: textStream(''),
    wait: vi.fn(async () => ({ exitCode: 0 })),
    kill: vi.fn(async () => {}),
  };
}

function makeSandbox({
  readTextFile = async () => null,
  writeTextFile = async () => {},
}: {
  readTextFile?: Experimental_SandboxSession['readTextFile'];
  writeTextFile?: Experimental_SandboxSession['writeTextFile'];
} = {}): Experimental_SandboxSession {
  return {
    description: 'test sandbox',
    readFile: async () => null,
    readBinaryFile: async () => null,
    readTextFile,
    writeFile: async () => {},
    writeBinaryFile: async () => {},
    writeTextFile,
    spawn: async () => makeProcess({ stdout: textStream('') }),
    run: async () => ({ exitCode: 0, stdout: '', stderr: '' }),
  };
}

describe('bridge readiness utilities', () => {
  it('resolves from stdout bridge-ready', async () => {
    const proc = makeProcess({
      stdout: textStream('{"type":"bridge-ready","port":4319}\n'),
    });

    await expect(
      waitForBridgeReady({
        proc,
        sandbox: makeSandbox(),
        bridgeStateDir: '/state',
        bridgeType: 'claude-code',
        timeoutMs: 1_000,
      }),
    ).resolves.toMatchObject({
      port: 4319,
      source: 'stdout',
    });
  });

  it('resolves from bridge metadata when stdout does not deliver', async () => {
    const proc = makeProcess({ stdout: pendingStream() });
    const sandbox = makeSandbox({
      readTextFile: async () =>
        JSON.stringify({
          type: 'claude-code',
          port: 4319,
          state: 'waiting',
          pid: 123,
        }),
    });

    await expect(
      waitForBridgeReady({
        proc,
        sandbox,
        bridgeStateDir: '/state',
        bridgeType: 'claude-code',
        timeoutMs: 1_000,
        pollIntervalMs: 1,
      }),
    ).resolves.toMatchObject({
      port: 4319,
      source: 'metadata',
    });
  });

  it('ignores non-waiting metadata', async () => {
    const proc = makeProcess({ stdout: pendingStream() });
    const reads: string[] = [
      JSON.stringify({ type: 'claude-code', state: 'starting' }),
      JSON.stringify({
        type: 'claude-code',
        port: 4319,
        state: 'waiting',
      }),
    ];
    const readTextFile = vi.fn(async () => reads.shift() ?? null);

    await expect(
      waitForBridgeReady({
        proc,
        sandbox: makeSandbox({ readTextFile }),
        bridgeStateDir: '/state',
        bridgeType: 'claude-code',
        timeoutMs: 1_000,
        pollIntervalMs: 1,
      }),
    ).resolves.toMatchObject({
      port: 4319,
      source: 'metadata',
    });
    expect(readTextFile).toHaveBeenCalledTimes(2);
  });

  it('waits for the poll interval between metadata reads', async () => {
    vi.useFakeTimers();
    try {
      const proc = makeProcess({ stdout: pendingStream() });
      const reads: string[] = [
        JSON.stringify({ type: 'claude-code', state: 'starting' }),
        JSON.stringify({
          type: 'claude-code',
          port: 4319,
          state: 'waiting',
        }),
      ];
      const readTextFile = vi.fn(async () => reads.shift() ?? null);

      const result = waitForBridgeReady({
        proc,
        sandbox: makeSandbox({ readTextFile }),
        bridgeStateDir: '/state',
        bridgeType: 'claude-code',
        timeoutMs: 1_000,
        pollIntervalMs: 50,
      });

      await Promise.resolve();
      await Promise.resolve();
      expect(readTextFile).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(49);
      expect(readTextFile).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1);
      await expect(result).resolves.toMatchObject({
        port: 4319,
        source: 'metadata',
      });
      expect(readTextFile).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('marks bridge startup metadata', async () => {
    const writes: Array<{ path: string; content: string }> = [];

    await markBridgeStarting({
      sandbox: makeSandbox({
        writeTextFile: async ({ path, content }) => {
          writes.push({ path, content });
        },
      }),
      bridgeStateDir: '/state',
      bridgeType: 'codex',
    });

    expect(writes).toEqual([
      {
        path: '/state/bridge-meta.json',
        content: JSON.stringify({ type: 'codex', state: 'starting' }),
      },
    ]);
  });
});
