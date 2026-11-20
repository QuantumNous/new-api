import type {
  HarnessDebugConfig,
  HarnessDiagnostic,
} from './observability/types';
import type { HarnessV1SandboxProvider } from '../v1';
import type {
  HarnessAgentAdapter,
  HarnessAgentPermissionMode,
  HarnessAgentSkill,
} from './harness-agent-types';
import type {
  Experimental_SandboxSession as SandboxSession,
  ToolSet,
} from '@ai-sdk/provider-utils';
import type { ActiveTools, TelemetryOptions, ToolApprovalStatus } from 'ai';
import type { HarnessAllTools } from './harness-agent-tool-types';

export type HarnessAgentToolApprovalConfiguration = Readonly<
  Record<string, ToolApprovalStatus>
>;

export type HarnessAgentSandboxConfig = {
  /**
   * Optional fixed working directory for all sessions, relative to the
   * sandbox's default working directory. When omitted, sessions keep the
   * existing `<harnessId>-<sessionId>` work directory.
   */
  readonly workDir?: string;

  /**
   * Caller-controlled identity for `onBootstrap`. Change this whenever the
   * bootstrap side effects should invalidate the reusable sandbox snapshot.
   */
  readonly bootstrapHash?: string;

  /**
   * Called during sandbox template creation after the harness adapter's own
   * bootstrap has run and before snapshot-capable providers publish a snapshot.
   *
   * `bootstrapHash` must be provided with this callback.
   */
  readonly onBootstrap?: (opts: {
    readonly session: SandboxSession;
    readonly workDir: string;
    readonly abortSignal?: AbortSignal;
  }) => Promise<void>;

  /**
   * Called after each sandbox session is acquired and the session work
   * directory exists, before the harness adapter starts. Runs for fresh and
   * resumed sessions.
   *
   * Use this to write per-session config, install lightweight tools, activate
   * licenses, or prepare files in `sessionWorkDir`. Keep it idempotent if the
   * agent may resume sessions.
   */
  readonly onSession?: (opts: {
    readonly session: SandboxSession;
    readonly sessionWorkDir: string;
    readonly abortSignal?: AbortSignal;
  }) => Promise<void>;
};

type HarnessTools<TOOLS extends ToolSet> = ActiveTools<NoInfer<TOOLS>>;

/**
 * Construction-time settings for a `HarnessAgent`.
 *
 * Per-call settings (prompt, abortSignal, callbacks) belong on the
 * `AgentCallParameters` / `AgentStreamParameters` passed to `generate` /
 * `stream` and are not duplicated here.
 */
type HarnessAgentToolFilteringSettings<TOOLS extends ToolSet> =
  | {
      /**
       * Limits the tools that are available for the harness to call without
       * changing the tool call and result types in the result.
       */
      readonly activeTools?: HarnessTools<TOOLS>;
      readonly inactiveTools?: never;
    }
  | {
      readonly activeTools?: never;
      /**
       * Excludes tools from the set that is available for the harness to call
       * without changing the tool call and result types in the result.
       */
      readonly inactiveTools?: HarnessTools<TOOLS>;
    };

export type HarnessAgentSettings<
  THarness extends HarnessAgentAdapter<any> = HarnessAgentAdapter,
  TUserTools extends ToolSet = {},
> = {
  /**
   * The harness adapter driving the underlying agent runtime. Its
   * `builtinTools` are merged with the user-defined `tools` and exposed to
   * AI SDK consumers in the typed `tool-call` stream.
   */
  readonly harness: THarness;

  /**
   * Stable identifier for this agent instance. Exposed via `agent.id`.
   * If omitted, `agent.id` is `undefined`.
   */
  readonly id?: string;

  /**
   * Tools available to the underlying runtime in addition to the harness's
   * own builtins. The agent forwards each tool to the harness as a
   * `HarnessAgentToolSpec`; when the runtime calls one, the agent executes
   * `tool.execute()` on the host and submits the result back to the harness.
   *
   * User tools take precedence over harness builtins on key collision —
   * declare a tool with the same name as a builtin to override.
   */
  readonly tools?: TUserTools;

  /**
   * Skills made available to the underlying runtime for the lifetime of
   * the session. Each adapter decides how to surface skills (file in the
   * working tree, prompt prefix, …).
   */
  readonly skills?: ReadonlyArray<HarnessAgentSkill>;

  /**
   * Instructions for the underlying agent runtime. Adapters prepend this to
   * the first user message of a fresh session, once — it is not re-applied on
   * later turns or when resuming a previously ended session.
   */
  readonly instructions?: string;

  /**
   * Built-in tool permission mode. Defaults to `'allow-all'`, preserving the
   * existing bypass-permissions behavior unless users opt in.
   */
  readonly permissionMode?: HarnessAgentPermissionMode;

  /**
   * Per custom-tool approval statuses. This mirrors AI SDK `toolApproval`
   * object configuration for host-executed tools, without callback support.
   *
   * `not-applicable` and `approved` run the tool, `user-approval` pauses the
   * turn for a user decision, and `denied` immediately submits an
   * `execution-denied` result.
   */
  readonly toolApproval?: HarnessAgentToolApprovalConfiguration;

  /**
   * Sandbox provider whose `create()` produces the network sandbox session the
   * harness runs against. Its `restricted()` view is also propagated to user
   * tool `execute()` calls (as the `experimental_sandbox` field), typed as
   * `Experimental_SandboxSession` so tools cannot reach the infra surface.
   */
  readonly sandbox: HarnessV1SandboxProvider;

  /**
   * Sandbox working-directory and lifecycle hook configuration.
   */
  readonly sandboxConfig?: HarnessAgentSandboxConfig;

  /** @deprecated Use `sandboxConfig.onSession` instead. */
  readonly onSandboxSession?: HarnessAgentSandboxConfig['onSession'];

  /**
   * Telemetry configuration. The harness drives AI SDK's pluggable
   * `Telemetry` integration contract from the turn lifecycle, so a harness turn
   * appears in a consumer's traces with the same span shape as `streamText`.
   * Register an integration here (e.g. `@ai-sdk/otel`) or globally via
   * `registerTelemetry`. The harness itself stays OpenTelemetry-agnostic.
   */
  readonly telemetry?: TelemetryOptions;

  /**
   * Diagnostics configuration. Enables bridge log forwarding (sandbox
   * console + structured `debug-event`s) and the `HARNESS_DEBUG` stderr default.
   * Set `{ enabled: true }` to turn it on in code; env vars fill unset fields.
   */
  readonly debug?: HarnessDebugConfig;

  /**
   * Programmatic sink for forwarded bridge diagnostics. Receives every
   * captured console line and structured event, normalized. Independent of the
   * stderr default — wire this to capture diagnostics in code.
   */
  readonly onLog?: (event: HarnessDiagnostic) => void;
} & HarnessAgentToolFilteringSettings<HarnessAllTools<THarness, TUserTools>>;
