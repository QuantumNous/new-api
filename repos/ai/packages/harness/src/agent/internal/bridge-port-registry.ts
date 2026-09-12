/**
 * Process-wide registry for bridge-port leases. Used when a sandbox provider
 * wraps a caller-provided sandbox with a pre-declared port pool — each
 * concurrent harness session leases one port from the pool, releases on
 * session stop or destroy. Multiple sessions on the same provider instance
 * share the same pool; different provider instances (even wrapping the same
 * underlying sandbox) get independent registries.
 *
 * Sized to the typical case: one provider object passed to N HarnessAgents.
 * Callers that need cross-process coordination must layer that on top.
 */

type RegistryEntry = {
  readonly pool: ReadonlyArray<number>;
  readonly leases: Map<string, number>;
};

const registries = new WeakMap<object, RegistryEntry>();

export function acquireBridgePort(options: {
  poolKey: object;
  pool: ReadonlyArray<number>;
  sessionId: string;
}): number {
  let entry = registries.get(options.poolKey);
  if (entry == null) {
    entry = { pool: options.pool, leases: new Map() };
    registries.set(options.poolKey, entry);
  }
  const existing = entry.leases.get(options.sessionId);
  if (existing != null) return existing;

  const leased = new Set(entry.leases.values());
  for (const port of entry.pool) {
    if (!leased.has(port)) {
      entry.leases.set(options.sessionId, port);
      return port;
    }
  }
  throw new Error(
    `No available bridge port — pool of ${entry.pool.length} ports is fully leased.`,
  );
}

export function releaseBridgePort(options: {
  poolKey: object;
  sessionId: string;
}): void {
  const entry = registries.get(options.poolKey);
  if (entry == null) return;
  entry.leases.delete(options.sessionId);
}
