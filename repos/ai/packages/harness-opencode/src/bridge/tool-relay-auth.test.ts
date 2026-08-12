import { describe, expect, test } from 'vitest';
import { ToolRelayAuthorizer } from './tool-relay-auth';

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
