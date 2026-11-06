import { HarnessCapabilityUnsupportedError } from '../errors/harness-capability-unsupported-error';
import type {
  HarnessV1Bootstrap,
  HarnessV1BuiltinToolFiltering,
  HarnessV1NetworkSandboxSession,
  HarnessV1SandboxProvider,
} from '../v1';
import {
  asSchema,
  generateId,
  type Context,
  type ModelMessage,
  type ToolSet,
} from '@ai-sdk/provider-utils';
import type {
  Agent,
  AgentCallParameters,
  AgentStreamParameters,
  GenerateTextResult,
  ReasoningFileOutput,
  ReasoningOutput,
  StreamTextResult,
} from 'ai';
import type {
  HarnessAgentSandboxConfig,
  HarnessAgentSettings,
} from './harness-agent-settings';
import type { HarnessAllTools } from './harness-agent-tool-types';
import { HarnessAgentSession } from './harness-agent-session';
import type {
  HarnessAgentAdapter,
  HarnessAgentContinueTurnState,
  HarnessAgentPermissionMode,
  HarnessAgentPrompt,
  HarnessAgentResumeSessionState,
  HarnessAgentToolSpec,
} from './harness-agent-types';
import {
  collectHarnessAgentToolApprovalContinuations,
  type HarnessAgentToolApprovalContinuation,
} from './harness-agent-tool-approval-continuation';
import { applyBootstrapRecipe } from './internal/bootstrap-recipe';
import {
  acquireBridgePort,
  releaseBridgePort,
} from './internal/bridge-port-registry';
import {
  createSandboxBootstrapPlan,
  ensureSandboxDirectory,
  resolveSessionWorkDir,
  validateSandboxBootstrapSettings,
  type SandboxBootstrapPlan,
} from './internal/sandbox-bootstrap';
import { buildObservability } from './internal/resolve-observability';
import { validateLifecycleStateData } from './internal/lifecycle-state-validation';
import {
  permissionModeNeedsBuiltinSupport,
  resolvePermissionMode,
} from './internal/permission-mode';
import { resolveHarnessAgentToolFiltering } from './internal/tool-filtering';

export type { HarnessAllTools } from './harness-agent-tool-types';

/**
 * Required `session` extension on every `HarnessAgent.generate` /
 * `HarnessAgent.stream` call. The agent operates exclusively on the
 * `HarnessAgentSession` the caller passes in — it owns no session
 * state of its own.
 */
export interface HarnessAgentCallExtensions {
  /**
   * Active session returned by `agent.createSession(...)`. Drives the
   * underlying harness adapter for this turn.
   */
  session: HarnessAgentSession;
}

/**
 * AI SDK `Agent` implementation that drives a third-party agent runtime
 * through a harness adapter (Claude Code, Codex, …).
 *
 * Behaviour summary:
 *  - **Stateless definition.** Construct once at module scope. The agent
 *    holds the harness adapter, the merged tool surface, the sandbox
 *    provider and other config — never a live session. Per-call data
 *    (prompt, abort signal, the `HarnessAgentSession`) lives on
 *    `generate()` / `stream()`.
 *  - **Explicit sessions.** Callers spawn sessions with
 *    `agent.createSession(...)`, pass the returned
 *    `HarnessAgentSession` on every `generate` / `stream`, and end it via
 *    `session.detach()`, `session.stop()`, or `session.destroy()`.
 *  - **Cross-process resume.** `createSession({ sessionId, resumeFrom })`
 *    resumes from state previously returned by `session.detach()` or
 *    `session.stop()`. The framework validates `resumeFrom` against the
 *    harness's `lifecycleStateSchema` before handing it to the adapter.
 *    `createSession({ sessionId, continueFrom })` resumes from state returned
 *    by `session.suspendTurn()` before `continueStream()` /
 *    `continueGenerate()`.
 *  - **Host tool execution.** User tools passed in `settings.tools` are
 *    executed on the host whenever the underlying runtime calls them;
 *    the result is fed back to the harness via `submitToolResult`.
 *    Adapter builtin tools (e.g. Claude Code's `Bash`) pass through
 *    untouched.
 *  - **Sandbox propagation.** `settings.sandbox` is a sandbox provider.
 *    On `createSession`, the agent calls `provider.createSession()` (or
 *    `resumeSession()`) and passes the resulting network sandbox session into
 *    `doStart`. Its `restricted()` view (a tool-safe
 *    `Experimental_SandboxSession`) is handed to user-tool `execute()` calls
 *    via `experimental_sandbox`.
 */
export class HarnessAgent<
  THarness extends HarnessAgentAdapter<any> = HarnessAgentAdapter,
  TUserTools extends ToolSet = {},
  RUNTIME_CONTEXT extends Context = Context,
> implements Agent<
  never,
  HarnessAllTools<THarness, TUserTools>,
  RUNTIME_CONTEXT,
  never
> {
  readonly version = 'agent-v1' as const;
  readonly id: string | undefined;

  /**
   * Merged tool set exposed to AI SDK consumers: harness builtins +
   * user-defined tools, with user tools overriding builtins on key
   * collision. Built once at construction time so the typed surface is
   * stable across calls.
   */
  readonly tools: HarnessAllTools<THarness, TUserTools>;

  private readonly settings: HarnessAgentSettings<THarness, TUserTools>;
  private readonly sandboxConfig: HarnessAgentSandboxConfig;
  private readonly activeUserTools: TUserTools;
  private readonly builtinToolFiltering:
    | HarnessV1BuiltinToolFiltering
    | undefined;
  private readonly permissionMode: HarnessAgentPermissionMode;

  constructor(settings: HarnessAgentSettings<THarness, TUserTools>) {
    const sandboxConfig = resolveSandboxConfig(settings);
    validateSandboxBootstrapSettings(sandboxConfig);
    this.settings = settings;
    this.sandboxConfig = sandboxConfig;
    this.id = settings.id;
    const userTools = settings.tools ?? ({} as TUserTools);
    this.permissionMode = resolvePermissionMode({
      permissionMode: settings.permissionMode,
    });
    const tools = {
      ...settings.harness.builtinTools,
      ...userTools,
    } as HarnessAllTools<THarness, TUserTools>;
    const toolFiltering = resolveHarnessAgentToolFiltering({
      harness: settings.harness,
      userTools,
      allTools: tools,
      activeTools: settings.activeTools,
      inactiveTools: settings.inactiveTools,
    });
    this.activeUserTools = toolFiltering.activeUserTools;
    this.builtinToolFiltering = toolFiltering.builtinToolFiltering;
    if (
      Object.keys(settings.harness.builtinTools).length > 0 &&
      permissionModeNeedsBuiltinSupport({
        permissionMode: this.permissionMode,
      }) &&
      settings.harness.supportsBuiltinToolApprovals !== true
    ) {
      throw new HarnessCapabilityUnsupportedError({
        message: `Harness '${settings.harness.harnessId}' does not support built-in tool approval requests; use permissionMode: 'allow-all'.`,
        harnessId: settings.harness.harnessId,
      });
    }
    this.tools = tools;
  }

  /** Identifier of the harness backing this agent. */
  get harnessId(): string {
    return this.settings.harness.harnessId;
  }

  /**
   * Start a fresh session, or resume from state previously returned by
   * `session.detach()` or `session.stop()`. The returned
   * `HarnessAgentSession` must be passed to subsequent `generate` / `stream`
   * calls; end it with `session.detach()`, `session.stop()`, or
   * `session.destroy()`.
   */
  async createSession(options?: {
    /**
     * Optional stable identifier for the underlying sandbox/session.
     * When omitted the agent generates one. Supply the original
     * `session.sessionId` together with `resumeFrom` to reattach a
     * previously ended session across processes.
     */
    sessionId?: string;
    /**
     * Resume payload returned by a prior `session.detach()` or
     * `session.stop()`. Must be accompanied by the original `sessionId`; the
     * framework validates it against `harness.lifecycleStateSchema` before
     * handing it to the adapter.
     */
    resumeFrom?: HarnessAgentResumeSessionState;
    /**
     * Continuation payload returned by a prior `session.suspendTurn()`. Must be
     * accompanied by the original `sessionId`; the framework validates it before
     * handing it to the adapter.
     */
    continueFrom?: HarnessAgentContinueTurnState;
    abortSignal?: AbortSignal;
  }): Promise<HarnessAgentSession> {
    const sessionId = options?.sessionId ?? generateId();
    const resumeFrom = options?.resumeFrom;
    const continueFrom = options?.continueFrom;
    const abortSignal = options?.abortSignal;
    const harness = this.settings.harness;
    const sandboxProvider = this.settings.sandbox;

    if (resumeFrom != null && continueFrom != null) {
      throw new Error(
        'HarnessAgent.createSession: pass either `resumeFrom` or `continueFrom`, not both.',
      );
    }

    let validatedResumeFrom: HarnessAgentResumeSessionState | undefined;
    if (resumeFrom != null) {
      validatedResumeFrom = await validateLifecycleStateData({
        harness,
        state: resumeFrom,
        expectedType: 'resume-session',
      });
    }

    let validatedContinueFrom: HarnessAgentContinueTurnState | undefined;
    if (continueFrom != null) {
      validatedContinueFrom = await validateLifecycleStateData({
        harness,
        state: continueFrom,
        expectedType: 'continue-turn',
      });
    }

    const effectiveContinueFrom =
      validatedContinueFrom ?? validatedResumeFrom?.continueFrom;
    const isResumedSession =
      validatedResumeFrom != null || effectiveContinueFrom != null;

    let recipe: HarnessV1Bootstrap | undefined;
    if (harness.getBootstrap != null) {
      recipe = await harness.getBootstrap({ abortSignal });
    }

    // Defines the hashes based on both harness bootstrap recipe and
    // consumer-defined onBootstrap callback.
    const sandboxBootstrapPlan = await createSandboxBootstrapPlan({
      recipe,
      settings: this.sandboxConfig,
    });

    // Acquires the concrete sandbox session, either by starting fresh and then
    // creating a post-bootstrap snapshot, or by reusing a previously created
    // snapshot based on the bootstrap-based hashes.
    const acquiredSandboxSession = await this._acquireSandbox({
      sandboxProvider,
      sessionId,
      isResume: isResumedSession,
      bootstrapPlan: sandboxBootstrapPlan,
      abortSignal,
    });

    const leased = applyPortLease({
      provider: sandboxProvider,
      sandboxSession: acquiredSandboxSession,
      sessionId,
    });
    const sandboxSession = leased.sandboxSession;
    const leasedBridgePort = leased.port;
    const sessionWorkDir = resolveSessionWorkDir({
      defaultWorkingDirectory: sandboxSession.defaultWorkingDirectory,
      harnessId: harness.harnessId,
      sessionId,
      workDir: sandboxBootstrapPlan.workDir,
    });

    try {
      // In case the sandbox session was created with a custom sandbox, or in
      // case the sandbox provider doesn't respect `onFirstCreate`, we still
      // have to ensure the harness bootstrap recipe has run. In the common
      // scenario, this will be a cheap no-op based on just a marker check.
      if (
        !isResumedSession &&
        sandboxBootstrapPlan.recipe != null &&
        sandboxBootstrapPlan.recipeIdentity != null
      ) {
        await applyBootstrapRecipe(
          sandboxSession.restricted(),
          sandboxBootstrapPlan.recipe,
          sandboxBootstrapPlan.recipeIdentity,
          { abortSignal },
        );
      }
      await ensureSandboxDirectory({
        session: sandboxSession,
        workDir: sessionWorkDir,
        abortSignal,
      });
      if (this.sandboxConfig.onSession != null) {
        await this.sandboxConfig.onSession({
          session: sandboxSession.restricted(),
          sessionWorkDir,
          abortSignal,
        });
      }
    } catch (err) {
      await cleanupAfterStartFailure({
        sandboxProvider,
        sandboxSession,
        sessionId,
        leasedBridgePort,
      });
      throw err;
    }

    try {
      const baseStartOptions = {
        sessionId,
        skills: this.settings.skills,
        resumeFrom: validatedResumeFrom,
        continueFrom: effectiveContinueFrom,
        permissionMode: this.permissionMode,
        builtinToolFiltering: this.builtinToolFiltering,
        abortSignal,
        observability: buildObservability({ settings: this.settings }),
      };
      const underlyingSession = await harness.doStart({
        ...baseStartOptions,
        sandboxSession,
        sessionWorkDir,
      });
      return new HarnessAgentSession({
        sessionId,
        harness,
        underlyingSession,
        sandboxSession,
        sandboxProvider,
        leasedBridgePort,
        sessionWorkDir,
        toolApproval: this.settings.toolApproval,
        pendingToolApprovals: effectiveContinueFrom?.pendingToolApprovals,
        turnState:
          effectiveContinueFrom == null
            ? 'idle'
            : effectiveContinueFrom.pendingToolApprovals != null &&
                effectiveContinueFrom.pendingToolApprovals.length > 0
              ? 'awaiting-approval'
              : 'suspended',
      });
    } catch (error) {
      await cleanupAfterStartFailure({
        sandboxProvider,
        sandboxSession,
        sessionId,
        leasedBridgePort,
      });
      throw error;
    }
  }

  async generate(
    options: AgentCallParameters<
      never,
      HarnessAllTools<THarness, TUserTools>,
      RUNTIME_CONTEXT
    > &
      HarnessAgentCallExtensions,
  ): Promise<
    GenerateTextResult<
      HarnessAllTools<THarness, TUserTools>,
      RUNTIME_CONTEXT,
      never
    >
  > {
    const turnInput = this._resolveTurnInput(options);
    const runtimeContext = {} as RUNTIME_CONTEXT;
    const { result, done } = this._startTurn({
      session: options.session,
      turnInput,
      runtimeContext,
      abortSignal: options.abortSignal,
    });
    await done;
    return this._toGenerateResult(result);
  }

  async stream(
    options: AgentStreamParameters<
      never,
      HarnessAllTools<THarness, TUserTools>,
      RUNTIME_CONTEXT
    > &
      HarnessAgentCallExtensions,
  ): Promise<
    StreamTextResult<
      HarnessAllTools<THarness, TUserTools>,
      RUNTIME_CONTEXT,
      never
    >
  > {
    const turnInput = this._resolveTurnInput(options);
    const runtimeContext = {} as RUNTIME_CONTEXT;
    const { result } = this._startTurn({
      session: options.session,
      turnInput,
      runtimeContext,
      abortSignal: options.abortSignal,
    });
    return result;
  }

  /**
   * Continue the in-flight turn **without a new prompt**, draining it like
   * {@link generate}. Used after `createSession({ continueFrom })` to finish
   * consuming a turn that crossed a process boundary.
   */
  async continueGenerate(options: {
    session: HarnessAgentSession;
    toolApprovalContinuations?: readonly HarnessAgentToolApprovalContinuation[];
    abortSignal?: AbortSignal;
  }): Promise<
    GenerateTextResult<
      HarnessAllTools<THarness, TUserTools>,
      RUNTIME_CONTEXT,
      never
    >
  > {
    const runtimeContext = {} as RUNTIME_CONTEXT;

    const { result, done } = this._startTurn({
      session: options.session,
      turnInput: {
        mode: 'continue',
        toolApprovalContinuations: options.toolApprovalContinuations ?? [],
      },
      runtimeContext,
      abortSignal: options.abortSignal,
    });
    await done;
    return this._toGenerateResult(result);
  }

  /**
   * Continue the in-flight turn **without a new prompt**, streaming its events
   * like {@link stream}. Used to keep consuming a turn that is still running
   * (or finished) in the runtime after a process boundary — the workflow slice
   * loop calls this on every slice after the first. Routes through the adapter's
   * `doContinueTurn`; what it can guarantee (lossless attach vs. lossy rerun)
   * follows from how the adapter resumed the session.
   */
  async continueStream(options: {
    session: HarnessAgentSession;
    toolApprovalContinuations?: readonly HarnessAgentToolApprovalContinuation[];
    abortSignal?: AbortSignal;
  }): Promise<
    StreamTextResult<
      HarnessAllTools<THarness, TUserTools>,
      RUNTIME_CONTEXT,
      never
    >
  > {
    const runtimeContext = {} as RUNTIME_CONTEXT;

    const { result } = this._startTurn({
      session: options.session,
      turnInput: {
        mode: 'continue',
        toolApprovalContinuations: options.toolApprovalContinuations ?? [],
      },
      runtimeContext,
      abortSignal: options.abortSignal,
    });
    return result;
  }

  // ─── Internals ──────────────────────────────────────────────────────

  private _startTurn(input: {
    session: HarnessAgentSession;
    turnInput:
      | { mode: 'prompt'; prompt: HarnessAgentPrompt }
      | {
          mode: 'continue';
          toolApprovalContinuations: readonly HarnessAgentToolApprovalContinuation[];
        };
    runtimeContext: RUNTIME_CONTEXT;
    abortSignal: AbortSignal | undefined;
  }): {
    result: StreamTextResult<
      HarnessAllTools<THarness, TUserTools>,
      RUNTIME_CONTEXT,
      never
    >;
    done: Promise<void>;
  } {
    if (input.turnInput.mode === 'continue') {
      return input.session.continueTurn<
        HarnessAllTools<THarness, TUserTools>,
        RUNTIME_CONTEXT
      >({
        instructions: this.settings.instructions,
        tools: this.tools,
        activeTools: this.activeUserTools,
        toolSpecs: this._toToolSpecs(),
        builtinToolFiltering: this.builtinToolFiltering,
        runtimeContext: input.runtimeContext,
        abortSignal: input.abortSignal,
        telemetry: this.settings.telemetry,
        toolApprovalContinuations: input.turnInput.toolApprovalContinuations,
      });
    }

    return input.session.promptTurn<
      HarnessAllTools<THarness, TUserTools>,
      RUNTIME_CONTEXT
    >({
      prompt: input.turnInput.prompt,
      instructions: this.settings.instructions,
      tools: this.tools,
      activeTools: this.activeUserTools,
      toolSpecs: this._toToolSpecs(),
      builtinToolFiltering: this.builtinToolFiltering,
      runtimeContext: input.runtimeContext,
      abortSignal: input.abortSignal,
      telemetry: this.settings.telemetry,
    });
  }

  private async _acquireSandbox(input: {
    sandboxProvider: HarnessV1SandboxProvider;
    sessionId: string;
    isResume: boolean;
    bootstrapPlan: SandboxBootstrapPlan;
    abortSignal: AbortSignal | undefined;
  }): Promise<HarnessV1NetworkSandboxSession> {
    const { sandboxProvider } = input;
    if (input.isResume) {
      if (sandboxProvider.resumeSession == null) {
        throw new HarnessCapabilityUnsupportedError({
          message: `Sandbox provider '${sandboxProvider.providerId}' does not support resume.`,
          harnessId: this.settings.harness.harnessId,
        });
      }
      return sandboxProvider.resumeSession({
        sessionId: input.sessionId,
        abortSignal: input.abortSignal,
      });
    }
    return sandboxProvider.createSession({
      sessionId: input.sessionId,
      abortSignal: input.abortSignal,
      identity: input.bootstrapPlan.identity,
      onFirstCreate: input.bootstrapPlan.onFirstCreate,
    });
  }

  /*
   * Reduce AI SDK input to the single user message the harness should run
   * for this turn. The harness session owns prior-turn state (system
   * prompt, assistant turns, tool results) — we never replay it. A bare
   * string is forwarded as-is; a message array is collapsed to its last
   * `role: 'user'` entry. Inputs whose only messages are non-user (system,
   * assistant, tool) have no fresh user input and are rejected.
   */
  private _resolveTurnInput(options: {
    prompt?: string | ModelMessage[];
    messages?: ModelMessage[];
  }):
    | { mode: 'prompt'; prompt: HarnessAgentPrompt }
    | {
        mode: 'continue';
        toolApprovalContinuations: readonly HarnessAgentToolApprovalContinuation[];
      } {
    if (typeof options.prompt === 'string') {
      return { mode: 'prompt', prompt: options.prompt };
    }
    const messages = Array.isArray(options.prompt)
      ? options.prompt
      : options.messages;
    if (Array.isArray(messages)) {
      const toolApprovalContinuations =
        collectHarnessAgentToolApprovalContinuations({ messages });
      if (toolApprovalContinuations.length > 0) {
        return {
          mode: 'continue',
          toolApprovalContinuations,
        };
      }
      for (let i = messages.length - 1; i >= 0; i--) {
        const message = messages[i];
        if (message?.role === 'user')
          return { mode: 'prompt', prompt: message };
      }
      throw new Error(
        'HarnessAgent: messages must contain at least one `role: "user"` entry.',
      );
    }
    throw new Error('HarnessAgent: either `prompt` or `messages` is required.');
  }

  /*
   * Wire-format projection of user-defined tools only. Harness builtins are
   * executed by the runtime and the bridge already knows about them — we
   * never re-declare them over the wire.
   */
  private _toToolSpecs(): HarnessAgentToolSpec[] {
    const specs: HarnessAgentToolSpec[] = [];
    for (const [name, tool] of Object.entries(
      this.activeUserTools as Record<string, unknown>,
    )) {
      const t = tool as {
        description?: string;
        inputSchema?: unknown;
      };
      let inputSchema: HarnessAgentToolSpec['inputSchema'];
      if (t.inputSchema != null) {
        try {
          inputSchema = asSchema(
            t.inputSchema as Parameters<typeof asSchema>[0],
          ).jsonSchema as HarnessAgentToolSpec['inputSchema'];
        } catch {
          // tools without a usable schema are still forwarded by name
        }
      }
      specs.push({ name, description: t.description, inputSchema });
    }
    return specs;
  }

  private async _toGenerateResult(
    streamResult: StreamTextResult<
      HarnessAllTools<THarness, TUserTools>,
      RUNTIME_CONTEXT,
      never
    >,
  ): Promise<
    GenerateTextResult<
      HarnessAllTools<THarness, TUserTools>,
      RUNTIME_CONTEXT,
      never
    >
  > {
    // The stream is already drained by the time generate() calls this helper
    // (done has resolved). `steps` is the single source of truth the result
    // derives everything else from, mirroring core's `generateText` result.
    const [steps, usage, responseMessages] = await Promise.all([
      streamResult.steps,
      streamResult.usage,
      streamResult.responseMessages,
    ]);

    return new HarnessGenerateTextResult<
      HarnessAllTools<THarness, TUserTools>,
      RUNTIME_CONTEXT
    >({ steps, usage, responseMessages });
  }
}

/*
 * `GenerateTextResult` view over a drained `streamText` run. Non-deprecated
 * members derive from `steps` (the single source of truth), and the deprecated
 * members are exposed as getters that delegate to `finalStep` / `usage`.
 * Implementing the deprecated members as getters — rather than assigning them
 * in an object literal — keeps construction free of deprecated-property usage,
 * matching how core's `generateText` builds its result.
 */
class HarnessGenerateTextResult<
  TOOLS extends ToolSet,
  RUNTIME_CONTEXT extends Context,
> implements GenerateTextResult<TOOLS, RUNTIME_CONTEXT, never> {
  readonly steps: GenerateTextResult<TOOLS, RUNTIME_CONTEXT, never>['steps'];
  readonly usage: GenerateTextResult<TOOLS, RUNTIME_CONTEXT, never>['usage'];
  readonly responseMessages: GenerateTextResult<
    TOOLS,
    RUNTIME_CONTEXT,
    never
  >['responseMessages'];
  readonly output = undefined as never;

  constructor(options: {
    steps: GenerateTextResult<TOOLS, RUNTIME_CONTEXT, never>['steps'];
    usage: GenerateTextResult<TOOLS, RUNTIME_CONTEXT, never>['usage'];
    responseMessages: GenerateTextResult<
      TOOLS,
      RUNTIME_CONTEXT,
      never
    >['responseMessages'];
  }) {
    this.steps = options.steps;
    this.usage = options.usage;
    this.responseMessages = options.responseMessages;
  }

  get finalStep() {
    return this.steps.at(-1)!;
  }

  get content() {
    return this.steps.flatMap(step => step.content);
  }

  get text() {
    return this.finalStep.text;
  }

  get files() {
    return this.steps.flatMap(step => step.files);
  }

  get sources() {
    return this.steps.flatMap(step => step.sources);
  }

  get toolCalls() {
    return this.steps.flatMap(step => step.toolCalls);
  }

  get staticToolCalls() {
    return this.steps.flatMap(step => step.staticToolCalls);
  }

  get dynamicToolCalls() {
    return this.steps.flatMap(step => step.dynamicToolCalls);
  }

  get toolResults() {
    return this.steps.flatMap(step => step.toolResults);
  }

  get staticToolResults() {
    return this.steps.flatMap(step => step.staticToolResults);
  }

  get dynamicToolResults() {
    return this.steps.flatMap(step => step.dynamicToolResults);
  }

  get finishReason() {
    return this.finalStep.finishReason;
  }

  get rawFinishReason() {
    return this.finalStep.rawFinishReason;
  }

  get warnings() {
    return this.steps.flatMap(step => step.warnings ?? []);
  }

  get reasoning() {
    return this.finalStep.content.filter(
      (part): part is ReasoningOutput | ReasoningFileOutput =>
        part.type === 'reasoning' || part.type === 'reasoning-file',
    );
  }

  get reasoningText() {
    return this.finalStep.reasoningText;
  }

  get totalUsage() {
    return this.usage;
  }

  get request() {
    return this.finalStep.request;
  }

  get response() {
    return this.finalStep.response;
  }

  get providerMetadata() {
    return this.finalStep.providerMetadata;
  }
}

function resolveSandboxConfig(
  settings: Pick<HarnessAgentSettings, 'sandboxConfig' | 'onSandboxSession'>,
): HarnessAgentSandboxConfig {
  if (settings.onSandboxSession != null) {
    console.warn(
      'HarnessAgent: `onSandboxSession` is deprecated. Use `sandboxConfig.onSession` instead.',
    );
  }

  return {
    ...settings.sandboxConfig,
    ...(settings.sandboxConfig?.onSession == null &&
    settings.onSandboxSession != null
      ? { onSession: settings.onSandboxSession }
      : {}),
  };
}

/*
 * Bridge-port leasing helper. Returns the port-narrowed network sandbox session
 * plus the leased port (or `undefined` when the provider has no port pool). Kept here
 * rather than on the session so the lease is established as part of session
 * start — the session only needs to release it on close/detach.
 */
function applyPortLease(input: {
  provider: HarnessV1SandboxProvider;
  sandboxSession: HarnessV1NetworkSandboxSession;
  sessionId: string;
}): {
  sandboxSession: HarnessV1NetworkSandboxSession;
  port: number | undefined;
} {
  const pool = input.provider.bridgePorts;
  if (pool == null || pool.length === 0) {
    return { sandboxSession: input.sandboxSession, port: undefined };
  }
  const port = acquireBridgePort({
    poolKey: input.provider,
    pool,
    sessionId: input.sessionId,
  });
  return {
    sandboxSession: narrowNetworkSessionPorts(input.sandboxSession, port),
    port,
  };
}

/*
 * Derive a view of the network sandbox session that reports only the leased
 * port. Implemented as a prototype-delegating overlay so every other member
 * (file I/O, exec, spawn, lifecycle, `restricted`) forwards to the same live
 * instance — only `ports` is shadowed.
 */
function narrowNetworkSessionPorts(
  sandboxSession: HarnessV1NetworkSandboxSession,
  leasedPort: number,
): HarnessV1NetworkSandboxSession {
  return Object.create(sandboxSession, {
    ports: {
      value: [leasedPort] as ReadonlyArray<number>,
      enumerable: true,
    },
  }) as HarnessV1NetworkSandboxSession;
}

async function cleanupAfterStartFailure(input: {
  sandboxProvider: HarnessV1SandboxProvider;
  sandboxSession: HarnessV1NetworkSandboxSession;
  sessionId: string;
  leasedBridgePort: number | undefined;
}): Promise<void> {
  await Promise.resolve(input.sandboxSession.stop()).catch(() => {});
  if (input.leasedBridgePort != null) {
    releaseBridgePort({
      poolKey: input.sandboxProvider,
      sessionId: input.sessionId,
    });
  }
}
