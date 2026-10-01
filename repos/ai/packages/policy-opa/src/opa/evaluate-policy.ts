import type { PolicyClient } from '../policy-client';

export type EvaluateOutcome =
  | { ok: true; result: unknown }
  | { ok: false; error: unknown };

/**
 * Evaluate a policy, capturing a backend error (OPA unreachable, WASM fault,
 * bad path) as a value instead of letting it throw. This is the package's
 * fail-closed invariant in one place: a thrown `client.evaluate` must never
 * escape into the SDK callback or middleware, where it would abort the run.
 * Each caller turns `ok: false` into its own safe fallback (deny / no tools).
 */
export async function evaluatePolicy(
  client: PolicyClient,
  path: string,
  input: unknown,
): Promise<EvaluateOutcome> {
  try {
    return { ok: true, result: await client.evaluate(path, input) };
  } catch (error) {
    return { ok: false, error };
  }
}
