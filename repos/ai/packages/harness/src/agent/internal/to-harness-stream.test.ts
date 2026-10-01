import { describe, expect, test, vi } from 'vitest';
import type { HarnessV1PromptControl } from '../../v1/harness-v1-prompt-control';
import type { HarnessV1StreamPart } from '../../v1/harness-v1-stream-part';
import { toHarnessStream } from './to-harness-stream';

/**
 * Build an `invoke` thunk for `toHarnessStream`. `run` produces the turn's
 * events against the supplied `emit`; its returned promise becomes `done`.
 */
function makeInvoke(opts: {
  run: (emit: (part: HarnessV1StreamPart) => void) => Promise<void>;
  control?: Partial<HarnessV1PromptControl>;
}) {
  return async (emit: (part: HarnessV1StreamPart) => void) => {
    const done = opts.run(emit);
    return {
      submitToolResult: vi.fn(async () => {}),
      ...opts.control,
      done,
    } as HarnessV1PromptControl;
  };
}

async function collect(
  stream: ReadableStream<HarnessV1StreamPart>,
): Promise<HarnessV1StreamPart[]> {
  const parts: HarnessV1StreamPart[] = [];
  const reader = stream.getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) return parts;
      parts.push(value);
    }
  } finally {
    reader.releaseLock();
  }
}

describe('toHarnessStream', () => {
  test('forwards emitted events in order and closes when done resolves', async () => {
    const { stream } = await toHarnessStream({
      invoke: makeInvoke({
        run: async emit => {
          emit({ type: 'stream-start' });
          emit({ type: 'text-start', id: 't1' });
          emit({ type: 'text-delta', id: 't1', delta: 'hello' });
          emit({ type: 'text-end', id: 't1' });
          emit({
            type: 'finish',
            finishReason: { unified: 'stop', raw: 'end_turn' },
            totalUsage: {
              inputTokens: {
                total: 10,
                noCache: 10,
                cacheRead: undefined,
                cacheWrite: undefined,
              },
              outputTokens: { total: 5, text: 5, reasoning: undefined },
            },
          });
        },
      }),
    });

    const parts = await collect(stream);
    expect(parts.map(p => p.type)).toEqual([
      'stream-start',
      'text-start',
      'text-delta',
      'text-end',
      'finish',
    ]);
  });

  test('returns the same control handle invoke produced', async () => {
    const submitToolResult = vi.fn(async () => {});
    const { control } = await toHarnessStream({
      invoke: makeInvoke({
        run: async () => {},
        control: { submitToolResult },
      }),
    });

    await control.submitToolResult({ toolCallId: 'c1', output: 'ok' });
    expect(submitToolResult).toHaveBeenCalledWith({
      toolCallId: 'c1',
      output: 'ok',
    });
  });

  test('enqueues an error part and closes the stream when done rejects', async () => {
    const boom = new Error('boom');
    let signalFailure!: (err: unknown) => void;

    const { stream } = await toHarnessStream({
      invoke: async emit => {
        emit({ type: 'text-delta', id: 't', delta: 'partial' });
        const done = new Promise<void>((_, reject) => {
          signalFailure = reject;
        });
        return {
          submitToolResult: vi.fn(async () => {}),
          done,
        } as HarnessV1PromptControl;
      },
    });

    // Trigger the failure after the stream is wired up. This mirrors how a
    // real adapter signals an error — the bridge / native runtime rejects
    // the done promise from a later async tick.
    signalFailure(boom);

    const parts = await collect(stream);
    expect(parts).toHaveLength(2);
    expect(parts[0]).toMatchObject({ type: 'text-delta', delta: 'partial' });
    expect(parts[1]).toMatchObject({ type: 'error', error: boom });
  });

  test('invokes the thunk once with a working emit', async () => {
    const invoke = vi.fn(
      async (
        _emit: (part: HarnessV1StreamPart) => void,
      ): Promise<HarnessV1PromptControl> => ({
        submitToolResult: vi.fn(async () => {}),
        done: Promise.resolve(),
      }),
    );

    await toHarnessStream({ invoke });

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(typeof invoke.mock.calls[0]![0]).toBe('function');
  });
});
