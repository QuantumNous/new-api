import { describe, expect, test } from 'vitest';
import { ToolRelayAuthorizer, ToolRelayPendingCalls } from './tool-relay-auth';

describe('ToolRelayAuthorizer', () => {
  test('rejects calls without prior authorization', () => {
    const authorizer = new ToolRelayAuthorizer();

    expect(
      authorizer.consumeToolCall({
        toolName: 'get_weather',
        input: { city: 'Paris' },
      }),
    ).toBe(false);
  });

  test('consumes matching authorization exactly once', () => {
    const authorizer = new ToolRelayAuthorizer();
    const call = { toolName: 'get_weather', input: { city: 'Paris' } };

    authorizer.authorizeToolCall(call);

    expect(authorizer.consumeToolCall(call)).toBe(true);
    expect(authorizer.consumeToolCall(call)).toBe(false);
  });

  test('consumes active command authorization exactly once', () => {
    const authorizer = new ToolRelayAuthorizer();
    const call = { toolName: 'get_weather', input: { city: 'Austin' } };

    authorizer.authorizeAnyToolCall();

    expect(authorizer.consumeToolCall(call)).toBe(true);
    expect(authorizer.consumeToolCall(call)).toBe(false);
  });

  test('prefers exact authorization over active command authorization', () => {
    const authorizer = new ToolRelayAuthorizer();
    const call = { toolName: 'get_weather', input: { city: 'Austin' } };

    authorizer.authorizeAnyToolCall();
    authorizer.authorizeToolCall(call);

    expect(authorizer.consumeToolCall(call)).toBe(true);
    expect(
      authorizer.consumeToolCall({
        toolName: 'get_weather',
        input: { city: 'Paris' },
      }),
    ).toBe(true);
    expect(authorizer.consumeToolCall(call)).toBe(false);
  });

  test('canonicalizes object input property order', () => {
    const authorizer = new ToolRelayAuthorizer();

    authorizer.authorizeToolCall({
      toolName: 'lookup',
      input: { b: 2, a: { d: 4, c: 3 } },
    });

    expect(
      authorizer.consumeToolCall({
        toolName: 'lookup',
        input: { a: { c: 3, d: 4 }, b: 2 },
      }),
    ).toBe(true);
  });

  test('expires stale authorizations', () => {
    let now = 1_000;
    const authorizer = new ToolRelayAuthorizer({
      ttlMs: 100,
      now: () => now,
    });

    authorizer.authorizeToolCall({ toolName: 'lookup', input: {} });
    now = 1_101;

    expect(authorizer.consumeToolCall({ toolName: 'lookup', input: {} })).toBe(
      false,
    );
  });
});

describe('ToolRelayPendingCalls', () => {
  test('coalesces duplicate calls while the first call is pending', async () => {
    const pendingCalls = new ToolRelayPendingCalls();
    const call = { toolName: 'get_weather', input: { city: 'Austin' } };
    let resolve!: (result: { output: unknown }) => void;
    const pending = new Promise<{ output: unknown }>(r => (resolve = r));
    let runCount = 0;

    const first = pendingCalls.begin({
      call,
      run: async () => {
        runCount++;
        return pending;
      },
    });
    const duplicate = pendingCalls.begin({
      call: { toolName: 'get_weather', input: { city: 'Austin' } },
      run: async () => {
        runCount++;
        return { output: { city: 'wrong' } };
      },
    });

    expect(first.isNew).toBe(true);
    expect(duplicate.isNew).toBe(false);
    expect(duplicate.result).toBe(first.result);
    expect(runCount).toBe(1);

    resolve({ output: { city: 'Austin', temperature: 72 } });

    await expect(first.result).resolves.toEqual({
      output: { city: 'Austin', temperature: 72 },
    });
    await expect(duplicate.result).resolves.toEqual({
      output: { city: 'Austin', temperature: 72 },
    });
    expect(runCount).toBe(1);
  });

  test('starts a new call after the pending call settles', async () => {
    const pendingCalls = new ToolRelayPendingCalls();
    const call = { toolName: 'get_weather', input: { city: 'Austin' } };

    const first = pendingCalls.begin({
      call,
      run: async () => ({ output: 'first' }),
    });
    await first.result;
    await Promise.resolve();

    const second = pendingCalls.begin({
      call,
      run: async () => ({ output: 'second' }),
    });

    expect(first.isNew).toBe(true);
    expect(second.isNew).toBe(true);
    await expect(second.result).resolves.toEqual({ output: 'second' });
  });

  test('canonicalizes duplicate object input property order', () => {
    const pendingCalls = new ToolRelayPendingCalls();
    const result = Promise.resolve({ output: 'ok' });

    const first = pendingCalls.begin({
      call: { toolName: 'lookup', input: { b: 2, a: { d: 4, c: 3 } } },
      run: async () => result,
    });
    const duplicate = pendingCalls.begin({
      call: { toolName: 'lookup', input: { a: { c: 3, d: 4 }, b: 2 } },
      run: async () => ({ output: 'wrong' }),
    });

    expect(first.isNew).toBe(true);
    expect(duplicate.isNew).toBe(false);
    expect(duplicate.result).toBe(first.result);
  });
});
