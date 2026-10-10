import { describe, expect, test } from 'vitest';
import { ToolRelayAuthorizer } from './tool-relay-auth';

describe('ToolRelayAuthorizer', () => {
  test('rejects calls without authorization', async () => {
    const authorizer = new ToolRelayAuthorizer({ ttlMs: 10 });

    await expect(
      authorizer.waitForToolCallAuthorization({
        toolName: 'get_weather',
        input: { city: 'Paris' },
      }),
    ).resolves.toBe(false);
  });

  test('consumes matching authorization exactly once', async () => {
    const authorizer = new ToolRelayAuthorizer({ ttlMs: 10 });
    const call = { toolName: 'get_weather', input: { city: 'Paris' } };

    authorizer.authorizeToolCall(call);

    await expect(authorizer.waitForToolCallAuthorization(call)).resolves.toBe(
      true,
    );
    await expect(authorizer.waitForToolCallAuthorization(call)).resolves.toBe(
      false,
    );
  });

  test('authorizes a request that arrives before the runtime event', async () => {
    const authorizer = new ToolRelayAuthorizer({ ttlMs: 100 });
    const call = { toolName: 'get_weather', input: { city: 'Paris' } };
    const authorization = authorizer.waitForToolCallAuthorization(call);

    authorizer.authorizeToolCall(call);

    await expect(authorization).resolves.toBe(true);
  });

  test('authorizes identical pending requests in FIFO order', async () => {
    const authorizer = new ToolRelayAuthorizer({ ttlMs: 100 });
    const call = { toolName: 'get_weather', input: { city: 'Austin' } };
    const first = authorizer.waitForToolCallAuthorization(call);
    const second = authorizer.waitForToolCallAuthorization(call);

    authorizer.authorizeToolCall(call);

    await expect(first).resolves.toBe(true);
    authorizer.close();
    await expect(second).resolves.toBe(false);
  });

  test('does not use an authorization for a different call', async () => {
    const authorizer = new ToolRelayAuthorizer({ ttlMs: 100 });
    const parisCall = {
      toolName: 'get_weather',
      input: { city: 'Paris' },
    };
    const austinCall = {
      toolName: 'get_weather',
      input: { city: 'Austin' },
    };
    const parisAuthorization =
      authorizer.waitForToolCallAuthorization(parisCall);

    authorizer.authorizeToolCall(austinCall);

    await expect(
      authorizer.waitForToolCallAuthorization(austinCall),
    ).resolves.toBe(true);
    authorizer.close();
    await expect(parisAuthorization).resolves.toBe(false);
  });

  test('canonicalizes object input property order', async () => {
    const authorizer = new ToolRelayAuthorizer();

    authorizer.authorizeToolCall({
      toolName: 'lookup',
      input: { b: 2, a: { d: 4, c: 3 } },
    });

    await expect(
      authorizer.waitForToolCallAuthorization({
        toolName: 'lookup',
        input: { a: { c: 3, d: 4 }, b: 2 },
      }),
    ).resolves.toBe(true);
  });

  test('expires stale authorizations', async () => {
    let now = 1_000;
    const authorizer = new ToolRelayAuthorizer({
      ttlMs: 10,
      now: () => now,
    });

    authorizer.authorizeToolCall({ toolName: 'lookup', input: {} });
    now = 1_011;

    await expect(
      authorizer.waitForToolCallAuthorization({
        toolName: 'lookup',
        input: {},
      }),
    ).resolves.toBe(false);
  });

  test('rejects pending requests when closed', async () => {
    const authorizer = new ToolRelayAuthorizer({ ttlMs: 100 });
    const authorization = authorizer.waitForToolCallAuthorization({
      toolName: 'lookup',
      input: {},
    });

    authorizer.close();

    await expect(authorization).resolves.toBe(false);
  });
});
