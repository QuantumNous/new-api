import type { PolicyClient } from '../policy-client';

/**
 * Returns a {@link PolicyClient} that always emits the same decision,
 * ignoring the path and input. Used to isolate adapter-under-test from any
 * real OPA backend.
 */
export function stubClient(decision: unknown): PolicyClient {
  return {
    async evaluate() {
      return decision as never;
    },
  };
}
