import type { PolicyDecision } from '../policy-decision';

/**
 * Normalize an OPA evaluation result into the package's {@link PolicyDecision}
 * shape.
 *
 * Supports two Rego output conventions:
 *
 * - **Recommended (explicit):** `{ "decision": "allow" | "deny" | "requires-approval", "reason": string }`.
 *   Maps to `approved` / `denied` / `user-approval` respectively.
 *
 * - **Legacy (boolean):** `{ "allow": boolean, "reason"?: string }`. `true`
 *   maps to `approved`, `false` to `denied`.
 *
 * Unknown shapes and `undefined` are treated as `not-applicable` so that a
 * Rego rule that does not match any branch defaults to "no opinion" rather
 * than blocking.
 */
export function normalizeOpaDecision(result: unknown): PolicyDecision {
  if (result == null) {
    return { type: 'not-applicable' };
  }

  if (typeof result !== 'object') {
    return { type: 'not-applicable' };
  }

  const record = result as Record<string, unknown>;
  const reason = typeof record.reason === 'string' ? record.reason : undefined;

  if (typeof record.decision === 'string') {
    switch (record.decision) {
      case 'allow':
        return withReason('approved', reason);
      case 'deny':
        return withReason('denied', reason);
      case 'requires-approval':
        return { type: 'user-approval' };
      case 'not-applicable':
        return { type: 'not-applicable' };
    }
  }

  if (typeof record.allow === 'boolean') {
    return withReason(record.allow ? 'approved' : 'denied', reason);
  }

  return { type: 'not-applicable' };
}

function withReason(
  type: 'approved' | 'denied',
  reason: string | undefined,
): PolicyDecision {
  return reason ? { type, reason } : { type };
}
