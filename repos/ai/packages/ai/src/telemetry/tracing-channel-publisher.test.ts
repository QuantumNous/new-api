import * as diagnosticsChannel from 'node:diagnostics_channel';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AI_SDK_TELEMETRY_TRACING_CHANNEL } from './tracing-channel';
import { runWithTracingChannelSpan } from './tracing-channel-publisher';
import { isNodeRuntime } from '../util/is-node-runtime';

// Mock the runtime guard so we can drive both branches deterministically,
// independent of the environment the test itself happens to run in.
vi.mock('../util/is-node-runtime', () => ({
  isNodeRuntime: vi.fn(),
}));

// Detect the real runtime without going through the mocked guard. These tests
// observe Node diagnostics-channel behavior, so they require Node's module
// support and are skipped in non-Node runtimes.
const runningOnNode =
  typeof process !== 'undefined' && process.release?.name === 'node';

describe.runIf(runningOnNode)(
  'runWithTracingChannelSpan runtime switch',
  () => {
    const message = {
      type: 'languageModelCall' as const,
      event: { callId: 'call-1' },
    };

    function subscribe(start: () => void) {
      const subscribers = {
        start,
        end() {},
        asyncStart() {},
        asyncEnd() {},
        error() {},
      };
      const channel = diagnosticsChannel.tracingChannel(
        AI_SDK_TELEMETRY_TRACING_CHANNEL,
      );
      channel.subscribe(subscribers);
      return () => channel.unsubscribe(subscribers);
    }

    beforeEach(() => {
      vi.mocked(isNodeRuntime).mockReset();
    });

    it('skips the diagnostics channel when not running on Node', async () => {
      vi.mocked(isNodeRuntime).mockReturnValue(false);

      const start = vi.fn();
      const unsubscribe = subscribe(start);

      try {
        const result = await runWithTracingChannelSpan(
          message,
          async () => 'result',
        );

        expect(result).toBe('result');
        // The non-Node branch returns before loading the channel, so an
        // existing subscriber is never invoked.
        expect(start).not.toHaveBeenCalled();
      } finally {
        unsubscribe();
      }
    });

    it('traces through the diagnostics channel when running on Node', async () => {
      vi.mocked(isNodeRuntime).mockReturnValue(true);

      const start = vi.fn();
      const unsubscribe = subscribe(start);

      try {
        const result = await runWithTracingChannelSpan(
          message,
          async () => 'result',
        );

        expect(result).toBe('result');
        // The Node branch loads the channel and traces execution, so the
        // subscriber receives the start event with our message context.
        expect(start).toHaveBeenCalledTimes(1);
        expect(start.mock.calls[0]![0]).toMatchObject(message);
      } finally {
        unsubscribe();
      }
    });
  },
);
