import type { FlexibleSchema, ToolSet } from '@ai-sdk/provider-utils';
import type { HarnessV1Bootstrap } from './harness-v1-bootstrap';
import type {
  HarnessV1Session,
  HarnessV1StartOptions,
} from './harness-v1-session';

/**
 * Versioned specification for a harness adapter — the integration point for
 * one third-party coding-agent runtime (Claude Code, Codex, …).
 *
 * Modelled after `LanguageModelV4`: a tagged spec version, a small set of
 * descriptive fields, and one entry-point method (`doStart`) that yields a
 * session. There is intentionally no static "capabilities" object —
 * optional features are signalled by the presence or absence of optional
 * methods on the prompt-control handle. Adapters that cannot satisfy a request
 * (manual compaction not supported, required port exposure unavailable, …)
 * throw `HarnessCapabilityUnsupportedError` from the method that needs the
 * capability.
 */
export type HarnessV1<TBuiltinTools extends ToolSet = ToolSet> = {
  /**
   * Spec version this adapter implements. Always the literal `'harness-v1'`.
   */
  readonly specificationVersion: 'harness-v1';

  /**
   * Stable identifier for this harness, used as the key inside
   * `HarnessV1Metadata` objects. Conventionally a kebab-case slug matching
   * the package name (`'claude-code'`, `'codex'`).
   */
  readonly harnessId: string;

  /**
   * Tools the adapter's underlying runtime exposes natively, as a `ToolSet`
   * keyed by what the bridge emits on `tool-call` events
   * (`commonName ?? nativeName`). Each entry is a `HarnessV1BuiltinTool`
   * (a `Tool` plus harness-specific `nativeName` / `commonName` metadata).
   *
   * The agent merges this with consumer-supplied user tools when validating
   * inbound tool calls and when typing the consumer-facing stream.
   */
  readonly builtinTools: TBuiltinTools;

  /**
   * Whether the adapter can emit approval requests for built-in tools when
   * `permissionMode` is not `'allow-all'`.
   *
   * Custom host-executed tool approvals are handled by `HarnessAgent`, so this
   * only describes adapter-native tool approval support.
   */
  readonly supportsBuiltinToolApprovals?: boolean;

  /**
   * Whether the adapter can prevent its underlying runtime from seeing or
   * calling inactive built-in tools for every tool in `builtinTools`.
   *
   * Adapters without native filtering can still support `activeTools` and
   * `inactiveTools` for built-ins when `supportsBuiltinToolApprovals` is
   * `true`: the framework routes inactive built-in tool calls through the
   * approval path and auto-denies them before they execute.
   */
  readonly supportsBuiltinToolFiltering?: boolean;

  /**
   * Optional schema for the adapter-defined `data` payload returned by session
   * lifecycle methods. When present, the adapter promises that exported state
   * validated by this schema can be re-imported in a future
   * `doStart({ resumeFrom })` or `doStart({ continueFrom })` call.
   */
  readonly lifecycleStateSchema?: FlexibleSchema<unknown>;

  /**
   * Optional bootstrap recipe. When defined, the harness session manager
   * computes a stable identity from the recipe, passes it (along with a
   * one-time recipe-application hook) to the sandbox provider, and applies
   * the recipe idempotently after the provider returns the handle.
   *
   * Adapters with no bootstrap needs omit this. Adapters that need to install
   * deps or ship bridge files into the sandbox declare them here so the
   * provider can cache the result across sessions via snapshots when
   * supported.
   */
  readonly getBootstrap?: (options?: {
    abortSignal?: AbortSignal;
  }) => PromiseLike<HarnessV1Bootstrap>;

  /**
   * Start a fresh session, resume a parked session via `resumeFrom`, or resume
   * an interrupted turn via `continueFrom`. The host then issues prompts against
   * the returned session, ending with `doDetach`, `doStop`, or `doDestroy`.
   */
  doStart(options: HarnessV1StartOptions): PromiseLike<HarnessV1Session>;
};
