import { describe, expect, it, vi } from 'vitest';
import { wasmPolicyClient } from './wasm-policy-client';

// Provide a working `loadPolicy` so we can exercise the evaluate path. The
// loaded policy's `evaluate` returns whatever the test queues up.
let nextResults: Array<{ result: unknown }> = [];
vi.mock('@open-policy-agent/opa-wasm', () => ({
  loadPolicy: async () => ({
    evaluate: () => nextResults,
    setData: () => {},
  }),
}));

describe('wasmPolicyClient.evaluate', () => {
  it('returns the first entry result on a normal response', async () => {
    nextResults = [{ result: { decision: 'deny', reason: 'no' } }];
    const client = await wasmPolicyClient({ wasm: new Uint8Array() });

    await expect(client.evaluate('p', {})).resolves.toEqual({
      decision: 'deny',
      reason: 'no',
    });
  });

  it('throws when the policy produced no result (empty array) so callers fail closed', async () => {
    nextResults = [];
    const client = await wasmPolicyClient({ wasm: new Uint8Array() });

    await expect(client.evaluate('p', {})).rejects.toThrow(
      /produced no result/,
    );
  });

  it('preserves a legitimately falsy result rather than swallowing it', async () => {
    nextResults = [{ result: false }];
    const client = await wasmPolicyClient({ wasm: new Uint8Array() });

    await expect(client.evaluate('p', {})).resolves.toBe(false);
  });

  it('throws (not a TypeError) when a misbehaving bundle returns a non-array', async () => {
    nextResults = null as never;
    const client = await wasmPolicyClient({ wasm: new Uint8Array() });

    await expect(client.evaluate('p', {})).rejects.toThrow(
      /produced no result/,
    );
  });
});
