import type { Experimental_SandboxSession as SandboxSession } from '@ai-sdk/provider-utils';
import type { HarnessV1NetworkSandboxSession } from './harness-v1-network-sandbox-session';

/**
 * Provider that produces network sandbox sessions for harness sessions. Lives at
 * module scope as a stable, synchronous object — analogous to
 * `LanguageModelV4` providers, no I/O performed at construction. The actual
 * sandbox is created (or wrapped) when `HarnessAgent` calls `createSession()`.
 */
export interface HarnessV1SandboxProvider {
  readonly specificationVersion: 'harness-sandbox-v1';
  readonly providerId: string;

  /**
   * Pool of ports the consumer reserved on a caller-provided sandbox for
   * concurrent harness sessions. The session manager leases one port per
   * session and releases on stop or destroy.
   *
   * Only meaningful when the provider wraps a caller-provided sandbox
   * (the caller pre-declared the ports). In create-new modes the provider
   * mints a fresh sandbox per session, so no leasing is needed; providers
   * leave this undefined.
   */
  readonly bridgePorts?: ReadonlyArray<number>;

  readonly createSession: (options?: {
    /**
     * Stable per-session identifier. When supplied, the provider names the
     * underlying resource deterministically so a future call to `resume`
     * (potentially from a different process) can find the same sandbox.
     * Omitted from prewarm and other paths that don't need a resumable
     * resource — in that case the provider falls back to its native
     * auto-naming.
     */
    sessionId?: string;
    abortSignal?: AbortSignal;
    /**
     * Stable identity for snapshot-based reuse. Providers that support
     * persistence/snapshots use this as part of the persistent sandbox
     * name; subsequent calls with the same identity resume from snapshot.
     *
     * Ignored when the provider is wrapping a caller-provided sandbox.
     */
    identity?: string;
    /**
     * Called exactly once per identity, on fresh creation. Snapshot-capable
     * providers wire this into the platform's one-time-setup hook so the
     * side effects are baked into the snapshot. Providers without snapshot
     * support run it immediately after fresh create.
     *
     * Not called when the provider is wrapping a caller-provided sandbox
     * (the caller owns the sandbox; the framework applies its own
     * idempotent bootstrap post-create instead).
     */
    onFirstCreate?: (
      session: SandboxSession,
      opts: { abortSignal?: AbortSignal },
    ) => Promise<void>;
  }) => PromiseLike<HarnessV1NetworkSandboxSession>;

  /**
   * Reattach to an existing sandbox previously created with the same
   * `sessionId`. Optional — providers that cannot rehydrate by id (e.g.
   * just-bash) omit this; the harness throws
   * `HarnessCapabilityUnsupportedError` when resume is attempted against
   * them.
   *
   * The provider derives the sandbox identifier from `sessionId` using the
   * same deterministic naming scheme it used in `createSession`. Returns a
   * network sandbox session bound to the existing resource.
   */
  readonly resumeSession?: (options: {
    sessionId: string;
    abortSignal?: AbortSignal;
  }) => PromiseLike<HarnessV1NetworkSandboxSession>;
}
