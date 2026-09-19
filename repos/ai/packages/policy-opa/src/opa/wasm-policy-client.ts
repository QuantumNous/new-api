import type { PolicyClient } from '../policy-client';

/**
 * Loaded OPA WASM bundle. Compiled offline with `opa build -t wasm` and
 * passed in as bytes.
 */
type LoadedPolicy = {
  evaluate(input: unknown): Array<{ result: unknown }>;
  /** Some versions expose `setData` for documents bundled at evaluation time. */
  setData?(data: unknown): void;
};

/**
 * Construct a {@link PolicyClient} that evaluates a compiled OPA WASM bundle
 * in-process using `@open-policy-agent/opa-wasm`.
 *
 * The `@open-policy-agent/opa-wasm` package is an optional peer dependency;
 * install it before using this client:
 *
 * ```sh
 * pnpm add @open-policy-agent/opa-wasm
 * ```
 *
 * The `path` argument to `evaluate(path, input)` is informational. The WASM
 * bundle is built around a fixed entrypoint at `opa build` time. The path is
 * recorded for audit logs but does not affect the evaluation.
 */
export async function wasmPolicyClient(opts: {
  wasm: Uint8Array | ArrayBuffer;
  /** Optional data document bundled into the policy (passed to `setData`). */
  data?: unknown;
}): Promise<PolicyClient> {
  type WasmModule = {
    loadPolicy(wasm: Uint8Array | ArrayBuffer): Promise<LoadedPolicy>;
  };

  let mod: WasmModule;
  try {
    mod =
      (await import('@open-policy-agent/opa-wasm')) as unknown as WasmModule;
  } catch (cause) {
    throw Object.assign(
      new Error(
        'Cannot import "@open-policy-agent/opa-wasm". Install it as a peer dependency to use wasmPolicyClient().',
      ),
      { cause },
    );
  }

  const policy = await mod.loadPolicy(opts.wasm);

  if (opts.data !== undefined && typeof policy.setData === 'function') {
    policy.setData(opts.data);
  }

  return {
    async evaluate(_path, input) {
      const results = policy.evaluate(input);
      // The WASM SDK returns an array of `{ result }` entries, one per
      // top-level expression in the entrypoint. A non-array or empty array
      // means the entrypoint produced no value (wrong entrypoint at
      // `opa build` time, an undefined decision rule, or a misbehaving
      // bundle). Throw rather than return undefined so the caller fails closed
      // instead of silently treating it as "no opinion".
      if (!Array.isArray(results) || results.length === 0) {
        throw Object.assign(
          new Error(
            'OPA WASM policy produced no result. Check that the bundle was built with the correct entrypoint (`opa build -t wasm -e <path>`).',
          ),
          { input },
        );
      }
      // Return the first entry's `result`, matching the HTTP client's
      // single-decision shape.
      return results[0].result as never;
    },
  };
}
