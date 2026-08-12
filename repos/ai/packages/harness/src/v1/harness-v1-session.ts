import type { HarnessV1NetworkSandboxSession } from './harness-v1-network-sandbox-session';
import type { HarnessV1Observability } from './harness-v1-observability';
import type { HarnessV1PermissionMode } from './harness-v1-permission-mode';
import type { HarnessV1Prompt } from './harness-v1-prompt';
import type { HarnessV1PromptControl } from './harness-v1-prompt-control';
import type {
  HarnessV1ContinueTurnState,
  HarnessV1ResumeSessionState,
} from './harness-v1-lifecycle-state';
import type { HarnessV1Skill } from './harness-v1-skill';
import type { HarnessV1StreamPart } from './harness-v1-stream-part';
import type { HarnessV1ToolSpec } from './harness-v1-tool-spec';
import type { HarnessV1BuiltinToolFiltering } from './harness-v1-tool-filtering';

/**
 * Options passed to `HarnessV1.doStart`.
 *
 * `sandboxSession` and `sessionWorkDir` are coupled and always present. The
 * framework creates the sandbox and per-session working directory before
 * calling the adapter, so adapters never need to derive provider-specific paths.
 */
export type HarnessV1StartOptions = {
  /**
   * Stable identifier for this harness session. Used as the underlying
   * resource name where the adapter has a notion of a named session
   * (sandbox name, native session id, …).
   */
  readonly sessionId: string;

  /**
   * Skills made available to the underlying runtime for the lifetime of
   * the session. Adapters decide how to surface them.
   */
  readonly skills?: ReadonlyArray<HarnessV1Skill>;

  /**
   * Optional resume payload returned by a prior session lifecycle method. When
   * provided, the adapter should resume the existing session before accepting a
   * new prompt or continuing a nested unfinished turn.
   */
  readonly resumeFrom?: HarnessV1ResumeSessionState;

  /**
   * Optional continuation payload returned by `doSuspendTurn`, or nested in
   * `resumeFrom`. When provided, the adapter should resume the existing session
   * in a shape ready for `doContinueTurn` rather than for a fresh prompt.
   */
  readonly continueFrom?: HarnessV1ContinueTurnState;

  /**
   * Approval policy for built-in adapter-native tool use. Custom host-executed
   * tools are approved by the framework before results are submitted back to
   * the adapter.
   */
  readonly permissionMode?: HarnessV1PermissionMode;

  /**
   * Adapter-native built-in tools that should be available for this session.
   * Custom host-executed tools are filtered by the framework before they reach
   * the adapter.
   */
  readonly builtinToolFiltering?: HarnessV1BuiltinToolFiltering;

  /**
   * Signal that aborts startup. The adapter must propagate cancellation to
   * any spawned processes or network calls.
   */
  readonly abortSignal?: AbortSignal;

  /**
   * Diagnostics wiring. The framework populates this; the adapter only
   * forwards `observability.onDiagnostic` into its `SandboxChannel` and
   * `observability.debug` into the bridge `start` message. Absent when the
   * consumer has not enabled diagnostics.
   */
  readonly observability?: HarnessV1Observability;
  /**
   * Network sandbox session the adapter operates against. It is owned and
   * lifecycled by `HarnessAgent`. Adapters call `restricted()` for the
   * tool-safe filesystem/exec/spawn surface, and use the infra methods
   * (`getPortUrl`, `ports`, `setNetworkPolicy`) for bridge wiring. Adapters
   * must not call `stop()` themselves; the agent does that during cleanup.
   */
  readonly sandboxSession: HarnessV1NetworkSandboxSession;

  /**
   * Absolute path the adapter runs the agent in for this session. Composed by
   * the framework as `<sandboxSession.defaultWorkingDirectory>/<harnessId>-<sessionId>`
   * and created before `doStart`, so the adapter uses it directly instead of
   * deriving its own provider-specific path.
   */
  readonly sessionWorkDir: string;
};

/**
 * Options passed to `HarnessV1Session.doPromptTurn`.
 */
export type HarnessV1PromptTurnOptions = {
  /**
   * Fresh input for this turn — either a plain string or a single
   * `ModelMessage`. The harness session owns its own conversation history,
   * so prior turns are never replayed across the contract.
   */
  readonly prompt: HarnessV1Prompt;

  /**
   * Host-defined tools to make available to the underlying runtime for this
   * turn. The harness emits `tool-call` events when the runtime calls one
   * and waits for `submitToolResult`.
   */
  readonly tools?: ReadonlyArray<HarnessV1ToolSpec>;

  /**
   * Free-form instructions for the session. The framework supplies the same
   * value on every turn; the adapter is responsible for applying it once, by
   * prepending it to the first user message of a fresh (non-resumed) session.
   * On a resumed session the adapter must not re-apply it — the original first
   * message already carried it and lives in the runtime's persisted history.
   */
  readonly instructions?: string;

  /**
   * Signal that aborts the in-flight turn. The adapter must cancel any
   * underlying work and resolve `done` (with an error if appropriate).
   */
  readonly abortSignal?: AbortSignal;

  /**
   * Callback invoked once for each event the adapter produces during the
   * turn. The adapter is responsible for the ordering and completeness of
   * events. `done` resolves once the adapter has emitted all events for the
   * turn (success or failure).
   */
  readonly emit: (event: HarnessV1StreamPart) => void;
};

/**
 * Options passed to `HarnessV1Session.doContinueTurn`.
 *
 * Unlike `doPromptTurn`, there is no `prompt`: `doContinueTurn` continues the
 * in-flight turn rather than starting a new one. It is used to continue a turn
 * that was previously suspended temporarily, e.g. by the workflow slice loop.
 */
export type HarnessV1ContinueTurnOptions = {
  /**
   * Host-defined tools to make available for the continued turn. Same shape
   * as `doPromptTurn`'s `tools`. An adapter that purely attaches to a live turn
   * may ignore them; an adapter that re-drives the turn (rerun) needs them.
   */
  readonly tools?: ReadonlyArray<HarnessV1ToolSpec>;

  /**
   * Signal that aborts the continued turn. The adapter must cancel any
   * underlying work and resolve `done` (with an error if appropriate).
   */
  readonly abortSignal?: AbortSignal;

  /**
   * Callback invoked once for each event the adapter produces while the
   * continued turn runs. Same contract as `doPromptTurn`'s `emit`.
   */
  readonly emit: (event: HarnessV1StreamPart) => void;
};

/**
 * Active harness session, returned by `HarnessV1.doStart`.
 *
 * A session is the unit of state continuity across multiple prompts (one
 * sandbox, one conversation history, one running agent runtime). The host
 * holds onto the session across `doPromptTurn` calls and ends the local
 * instance via `doDetach`, `doStop`, or `doDestroy`.
 */
export type HarnessV1Session = {
  /**
   * Stable identifier for this session. Same value the host passed in via
   * `HarnessV1StartOptions.sessionId`.
   */
  readonly sessionId: string;

  /**
   * Whether this session was created from `resumeFrom` or `continueFrom`. Fresh
   * sessions report `false`; resumed sessions report `true`.
   */
  readonly isResume: boolean;

  /**
   * The model id the underlying runtime is configured to use, if the adapter
   * knows it (e.g. from its settings). Surfaced into telemetry as
   * `gen_ai.request.model` and the trace span labels. Omitted when the adapter
   * defers to the runtime's own default and has no concrete id.
   */
  readonly modelId?: string;

  /**
   * Run one prompt turn. Returns a control handle the host uses to feed
   * tool results, approvals, and user messages back into the turn while it
   * is in flight. The handle's `done` promise resolves when the turn ends.
   */
  doPromptTurn(
    options: HarnessV1PromptTurnOptions,
  ): PromiseLike<HarnessV1PromptControl>;

  /**
   * Request that the underlying runtime compact its context. The runtime owns
   * the compaction — the harness neither implements nor schedules it; this is
   * only the trigger. When compaction completes, the adapter surfaces a
   * `compaction` stream part on the next/active turn.
   *
   * Required, but not every runtime can honour it: adapters whose transport
   * exposes no manual compaction (e.g. Codex over `codex exec`, which still
   * auto-compacts on its own) throw `HarnessCapabilityUnsupportedError`.
   * `customInstructions`, when supported, steer the compaction summary.
   */
  doCompact(customInstructions?: string): PromiseLike<void>;

  /**
   * Continue the in-flight turn **without a new user prompt**, returning the
   * same control surface as `doPromptTurn`. Used to keep consuming a turn that
   * was interrupted at a process boundary (the workflow slice loop), after the
   * session itself has been resumed via `doStart({ continueFrom })`:
   *
   *  - When the runtime's turn is still live and reachable (bridge `attach` /
   *    `replay`), the adapter subscribes to its events and resolves `done` on
   *    the turn's `finish` — **without** re-driving it. Lossless.
   *  - When the live turn is gone (bridge respawned `rerun`, or a host-resident
   *    runtime like Pi whose turn cannot survive its process), the adapter
   *    re-drives the runtime's own thread from its persisted state. Lossy: work
   *    in flight at the interruption is recomputed.
   *
   * Required on every adapter. The behaviour an adapter can guarantee follows
   * from its architecture; the contract is uniform.
   */
  doContinueTurn(
    options: HarnessV1ContinueTurnOptions,
  ): PromiseLike<HarnessV1PromptControl>;

  /**
   * Gracefully freeze the active turn **at a precise cursor while keeping the
   * runtime alive**, returning the continuation payload.
   *
   * This is the slice-boundary primitive. The adapter stops host-side
   * consumption of the in-flight turn without telling the runtime to stop:
   * for a bridge adapter it closes the host socket (the bridge keeps the turn
   * running and accumulates events for replay) and resolves the active
   * `doPromptTurn`/`doContinueTurn` `done` **cleanly** (not as an error) once buffered
   * events have drained, so the cursor in the returned state equals the last
   * event delivered to the host — guaranteeing the next slice's attach replays
   * with no gap and no duplicate. A host-resident adapter (Pi) cannot keep its
   * turn alive, so it persists what it can and the in-flight tail is recomputed
   * on continue.
   *
   * Like `doDetach`, the sandbox/runtime is left running. Unlike `doDetach`,
   * this is for an active turn at a slice boundary rather than a between-turn
   * session handoff. Required on every adapter.
   */
  doSuspendTurn(): PromiseLike<HarnessV1ContinueTurnState>;

  /**
   * Detach from the underlying runtime without tearing it down, returning a
   * payload the host can later pass to
   * `HarnessV1.doStart({ resumeFrom })` to reconnect before a new turn. After
   * `doDetach`, no further methods on this session instance may be called.
   *
   * Required. Adapters that cannot keep a live runtime parked still return the
   * best resume session state they can while leaving the sandbox running.
   */
  doDetach(): PromiseLike<HarnessV1ResumeSessionState>;

  /**
   * Persist enough state to resume later, then stop the underlying runtime.
   * After `doStop`, no further methods on this session instance may be called.
   */
  doStop(): PromiseLike<HarnessV1ResumeSessionState>;

  /**
   * Stop the underlying runtime without returning lifecycle state. After
   * `doDestroy`, no further methods on this session instance may be called.
   */
  doDestroy(): PromiseLike<void>;
};
