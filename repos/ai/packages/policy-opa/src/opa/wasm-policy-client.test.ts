import { describe, expect, it, vi } from 'vitest';
import { wasmPolicyClient } from './wasm-policy-client';

// Simulate the peer dep being absent: any dynamic import of
// '@open-policy-agent/opa-wasm' is intercepted and rejected so the
// lazy-import fallback path in the client fires.
vi.mock('@open-policy-agent/opa-wasm', () => {
  throw new Error('intentional test failure: module unresolved');
});

describe('wasmPolicyClient', () => {
  it('throws a clear install-as-peer-dep error when @open-policy-agent/opa-wasm is absent', async () => {
    await expect(wasmPolicyClient({ wasm: new Uint8Array() })).rejects.toThrow(
      /Cannot import "@open-policy-agent\/opa-wasm"\. Install it as a peer dependency/,
    );
  });

  it('attaches the underlying import error as `cause` (ES2018-safe)', async () => {
    try {
      await wasmPolicyClient({ wasm: new Uint8Array() });
      throw new Error('should have rejected');
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error & { cause?: unknown }).cause).toBeDefined();
    }
  });
});
