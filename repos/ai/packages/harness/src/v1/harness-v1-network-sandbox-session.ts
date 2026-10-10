import type { Experimental_SandboxSession as SandboxSession } from '@ai-sdk/provider-utils';

/**
 * Network sandbox session returned by `HarnessV1SandboxProvider.createSession()`. The
 * harness keeps this for the lifetime of a session. It is itself a
 * {@link SandboxSession} (file I/O, exec, spawn) and adds the infra surface on
 * top: port resolution, lifecycle, and network-policy mutation.
 *
 * Code that should only touch the filesystem and spawn processes receives the
 * reduced view from {@link HarnessV1NetworkSandboxSession.restricted}, never the
 * network sandbox session itself — so it cannot stop the sandbox or change its
 * network policy.
 */
export interface HarnessV1NetworkSandboxSession extends SandboxSession {
  /**
   * Stable identifier for the underlying sandbox resource. Used by the
   * harness session manager as the durable lookup key for cross-process
   * resume — the framework persists this on lifecycle state so a future
   * process can call `HarnessV1SandboxProvider.resume?({ sessionId })` and
   * reach the same resource. Providers populate it from their native
   * identifier (Vercel: the sandbox name; just-bash: a UUID minted at
   * create time).
   */
  readonly id: string;

  /**
   * The sandbox's default working directory — the absolute path that
   * `run`/`spawn` resolve relative commands against when no `workingDirectory`
   * is given. Read from the live sandbox (it is provider-specific and
   * configurable at create time: Vercel defaults to `/vercel/sandbox`,
   * just-bash to `/home/user`), never hardcoded.
   *
   * The framework composes each session's working directory underneath this
   * path (`<defaultWorkingDirectory>/<harnessId>-<sessionId>`) so adapters do
   * not bake a provider-specific base into their own paths.
   */
  readonly defaultWorkingDirectory: string;

  /** Ports the sandbox exposes; resolvable to public URLs via `getPortUrl`. */
  readonly ports: ReadonlyArray<number>;

  /**
   * Resolve a publicly-reachable URL for a sandbox-exposed port. Bridge-backed
   * adapters call this to open their WebSocket to the in-sandbox bridge.
   */
  readonly getPortUrl: (options: {
    port: number;
    protocol?: 'http' | 'https' | 'ws';
  }) => PromiseLike<string>;

  /** Stop the sandbox. Idempotent. */
  readonly stop: () => PromiseLike<void>;

  /**
   * Destroy/delete the sandbox resource when supported. Optional because some
   * providers only have a stop/dispose concept. Implementations must handle
   * both a still-running sandbox and a previously stopped sandbox.
   */
  readonly destroy?: () => PromiseLike<void>;

  /**
   * Update the sandbox's outbound network policy. Optional — implementations
   * without a local enforcement primitive (e.g. just-bash) omit this. Callers
   * use optional-call (`sandboxSession.setNetworkPolicy?.(policy)`); a
   * missing implementation is a no-op.
   */
  readonly setNetworkPolicy?: (
    policy: HarnessV1NetworkPolicy,
  ) => PromiseLike<void>;

  /**
   * Replace the set of ports exposed by the sandbox. Full-replacement
   * semantics: ports omitted from the array are deregistered. Optional —
   * implementations that cannot expose ports (e.g. just-bash) omit this.
   */
  readonly setPorts?: (
    ports: ReadonlyArray<number>,
    options?: { abortSignal?: AbortSignal },
  ) => PromiseLike<void>;

  /**
   * Reduced view of this session, typed as the bare {@link SandboxSession}
   * (file I/O, exec, spawn) — nothing that could stop the sandbox or change
   * its network policy. Pass this to user-tool `execute()` calls and other
   * code that must not reach the infra surface.
   *
   * The returned object points at exactly the same underlying sandbox
   * resource as the network sandbox session it was produced from; it is only a
   * narrower surface over the same resource, not a separate sandbox.
   */
  readonly restricted: () => SandboxSession;
}

/**
 * Outbound network policy applied by the sandbox runtime.
 *
 * `'allow-all'` and `'deny-all'` are convenience presets. `'custom'` is an
 * allow-list with an optional CIDR deny-list that takes precedence:
 *
 * - Reachable hosts are the union of `allowedHosts` and `allowedCIDRs`.
 * - `deniedCIDRs` wins over both, useful for blocking cloud-metadata IPs while
 *   otherwise allowing broad access.
 *
 * The two `'custom'` branches share the same discriminator but each requires
 * a different allow field. Specifying `'custom'` with only `deniedCIDRs`
 * (deny-only) is rejected at compile time — functionally it would be
 * equivalent to `'deny-all'`.
 */
export type HarnessV1NetworkPolicy =
  | { mode: 'allow-all' }
  | { mode: 'deny-all' }
  | {
      mode: 'custom';
      allowedHosts: ReadonlyArray<string>;
      allowedCIDRs?: ReadonlyArray<string>;
      deniedCIDRs?: ReadonlyArray<string>;
    }
  | {
      mode: 'custom';
      allowedHosts?: ReadonlyArray<string>;
      allowedCIDRs: ReadonlyArray<string>;
      deniedCIDRs?: ReadonlyArray<string>;
    };
