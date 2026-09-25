import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Callback } from './callback';
import { notify } from './notify';
import { delay } from '@ai-sdk/provider-utils';

describe('notify', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('callback invocation', () => {
    it('should call a single callback with the event', async () => {
      const calls: string[] = [];

      await notify({
        event: { value: 'hello' },
        callbacks: event => {
          calls.push(event.value);
        },
      });

      expect(calls).toMatchInlineSnapshot(`
        [
          "hello",
        ]
      `);
    });

    it('should call all callbacks when given an array', async () => {
      const calls: string[] = [];

      await notify({
        event: { value: 'hello' },
        callbacks: [
          event => {
            calls.push(`first: ${event.value}`);
          },
          event => {
            calls.push(`second: ${event.value}`);
          },
        ],
      });

      expect(calls).toMatchInlineSnapshot(`
        [
          "first: hello",
          "second: hello",
        ]
      `);
    });

    it('should handle undefined callbacks', async () => {
      await notify({ event: { value: 'hello' }, callbacks: undefined });
    });

    it('should handle omitted callbacks', async () => {
      await notify({ event: { value: 'hello' } });
    });
  });

  describe('async support', () => {
    it('should await async callbacks before continuing', async () => {
      const calls: string[] = [];

      const notifyPromise = notify({
        event: 'test',
        callbacks: async () => {
          await delay(1);
          calls.push('async done');
        },
      });

      await vi.advanceTimersByTimeAsync(1);
      await notifyPromise;

      calls.push('after notify');

      expect(calls).toMatchInlineSnapshot(`
        [
          "async done",
          "after notify",
        ]
      `);
    });

    it('should run async callbacks in parallel and await all of them', async () => {
      const calls: string[] = [];
      let resolveSlowCallback!: () => void;

      const notifyPromise = notify({
        event: 'test',
        callbacks: [
          async () => {
            calls.push('slow start');
            await new Promise<void>(resolve => {
              resolveSlowCallback = () => {
                calls.push('slow end');
                resolve();
              };
            });
          },
          () => {
            calls.push('fast start');
            calls.push('fast end');
          },
        ],
      });

      expect(calls).toMatchInlineSnapshot(`
        [
          "slow start",
          "fast start",
          "fast end",
        ]
      `);

      resolveSlowCallback();
      await notifyPromise;

      expect(calls).toMatchInlineSnapshot(`
        [
          "slow start",
          "fast start",
          "fast end",
          "slow end",
        ]
      `);
    });
  });

  describe('error handling', () => {
    it('should catch errors in a single callback without breaking', async () => {
      const calls: string[] = [];

      await notify({
        event: 'test',
        callbacks: () => {
          calls.push('before throw');
          throw new Error('callback error');
        },
      });

      calls.push('after notify');

      expect(calls).toMatchInlineSnapshot(`
        [
          "before throw",
          "after notify",
        ]
      `);
    });

    it('should catch errors in array callbacks and continue to next', async () => {
      const calls: string[] = [];

      await notify({
        event: 'test',
        callbacks: [
          () => {
            calls.push('first before throw');
            throw new Error('first error');
          },
          () => {
            calls.push('second runs');
          },
        ],
      });

      expect(calls).toMatchInlineSnapshot(`
        [
          "first before throw",
          "second runs",
        ]
      `);
    });

    it('should catch async rejection without breaking', async () => {
      const calls: string[] = [];

      await notify({
        event: 'test',
        callbacks: async () => {
          calls.push('async before reject');
          throw new Error('async error');
        },
      });

      calls.push('after notify');

      expect(calls).toMatchInlineSnapshot(`
        [
          "async before reject",
          "after notify",
        ]
      `);
    });
  });

  describe('type safety', () => {
    it('should preserve event type through to callback', async () => {
      interface MyEvent {
        toolName: string;
        input: { location: string };
        stepNumber: number;
      }

      const received: MyEvent[] = [];

      const callback: Callback<MyEvent> = event => {
        received.push(event);
      };

      await notify({
        event: {
          toolName: 'getWeather',
          input: { location: 'San Francisco' },
          stepNumber: 2,
        },
        callbacks: callback,
      });

      expect(received).toMatchInlineSnapshot(`
        [
          {
            "input": {
              "location": "San Francisco",
            },
            "stepNumber": 2,
            "toolName": "getWeather",
          },
        ]
      `);
    });

    it('should work with complex nested event types', async () => {
      const received: unknown[] = [];

      await notify({
        event: {
          model: { provider: 'openai', modelId: 'gpt-4o' },
          usage: { inputTokens: 100, outputTokens: 50 },
          steps: [{ stepNumber: 0 }, { stepNumber: 1 }],
        },
        callbacks: event => {
          received.push({
            provider: event.model.provider,
            totalSteps: event.steps.length,
          });
        },
      });

      expect(received).toMatchInlineSnapshot(`
        [
          {
            "provider": "openai",
            "totalSteps": 2,
          },
        ]
      `);
    });
  });

  describe('multiple sequential notifications', () => {
    it('should handle repeated calls with the same callback', async () => {
      const events: string[] = [];
      const callback: Callback<string> = event => {
        events.push(event);
      };

      await notify({ event: 'first', callbacks: callback });
      await notify({ event: 'second', callbacks: callback });
      await notify({ event: 'third', callbacks: callback });

      expect(events).toMatchInlineSnapshot(`
        [
          "first",
          "second",
          "third",
        ]
      `);
    });
  });
});
