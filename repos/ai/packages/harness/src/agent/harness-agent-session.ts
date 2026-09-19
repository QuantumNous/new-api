import type { Context, ToolSet } from '@ai-sdk/provider-utils';
import type { StreamTextResult, TelemetryOptions } from 'ai';
import type { HarnessAgentToolApprovalConfiguration } from './harness-agent-settings';
import type {
  HarnessV1BuiltinToolFiltering,
  HarnessV1NetworkSandboxSession,
  HarnessV1SandboxProvider,
} from '../v1';
import type {
  HarnessAgentAdapter,
  HarnessAgentAdapterSession,
  HarnessAgentContinueTurnState,
  HarnessAgentPendingToolApproval,
  HarnessAgentPrompt,
  HarnessAgentResumeSessionState,
  HarnessAgentToolSpec,
} from './harness-agent-types';
import type { HarnessAgentToolApprovalContinuation } from './harness-agent-tool-approval-continuation';
import { releaseBridgePort } from './internal/bridge-port-registry';
import { validateLifecycleStateData } from './internal/lifecycle-state-validation';
import { runPrompt } from './internal/run-prompt';

type HarnessAgentTurnResult<
  TOOLS extends ToolSet,
  RUNTIME_CONTEXT extends Context,
> = {
  result: StreamTextResult<TOOLS, RUNTIME_CONTEXT, never>;
  done: Promise<void>;
};

type HarnessAgentSessionState = 'active' | 'detached' | 'stopped' | 'destroyed';

type HarnessAgentTurnState =
  | 'idle'
  | 'running'
  | 'awaiting-approval'
  | 'suspended';

/**
 * Live harness session held by the caller.
 *
 * Created by {@link import('./harness-agent').HarnessAgent.createSession}.
 * Owns the underlying adapter session, the network sandbox session, and the
 * bridge-port lease (when the provider wraps a caller-provided sandbox with a
 * port pool).
 *
 * Pass the instance back to `agent.generate` / `agent.stream` on every
 * call; end the local handle with `detach()`, `stop()`, or `destroy()`.
 *
 * After any lifecycle method has resolved, the session is unusable — any
 * subsequent `generate`/`stream` call against it throws.
 */
export class HarnessAgentSession {
  /**
   * Stable identifier the harness adapter saw in `doStart`. The same
   * string callers persist when they intend to resume the session in a
   * future process.
   */
  readonly sessionId: string;

  private readonly harness: HarnessAgentAdapter;
  private readonly sandboxProvider: HarnessV1SandboxProvider;
  private readonly sessionWorkDir: string;
  private underlyingSession: HarnessAgentAdapterSession | undefined;
  private sandboxSession: HarnessV1NetworkSandboxSession | undefined;
  private leasedBridgePort: number | undefined;
  private readonly toolApproval:
    | HarnessAgentToolApprovalConfiguration
    | undefined;
  private readonly pendingToolApprovals = new Map<
    string,
    HarnessAgentPendingToolApproval
  >();
  private sessionState: HarnessAgentSessionState = 'active';
  private turnState: HarnessAgentTurnState;
  private turnSequence = 0;
  private activeTurnSequence = 0;

  /**
   * Whether this session was created from `resumeFrom` or `continueFrom`.
   * Captured at construction so it survives lifecycle cleanup.
   */
  readonly isResume: boolean;

  constructor(options: {
    sessionId: string;
    harness: HarnessAgentAdapter;
    underlyingSession: HarnessAgentAdapterSession;
    sandboxSession: HarnessV1NetworkSandboxSession;
    sandboxProvider: HarnessV1SandboxProvider;
    leasedBridgePort?: number;
    sessionWorkDir: string;
    toolApproval: HarnessAgentToolApprovalConfiguration | undefined;
    pendingToolApprovals?: readonly HarnessAgentPendingToolApproval[];
    turnState?: HarnessAgentTurnState;
  }) {
    this.sessionId = options.sessionId;
    this.harness = options.harness;
    this.underlyingSession = options.underlyingSession;
    this.sandboxSession = options.sandboxSession;
    this.sandboxProvider = options.sandboxProvider;
    this.leasedBridgePort = options.leasedBridgePort;
    this.sessionWorkDir = options.sessionWorkDir;
    this.toolApproval = options.toolApproval;
    for (const approval of options.pendingToolApprovals ?? []) {
      this.pendingToolApprovals.set(approval.approvalId, approval);
    }
    this.turnState =
      options.turnState ??
      (this.pendingToolApprovals.size > 0 ? 'awaiting-approval' : 'idle');
    this.isResume = options.underlyingSession.isResume;
  }

  /**
   * Active network sandbox session.
   *
   * @internal — accessed by session turn and lifecycle drivers.
   */
  getSandboxSession(): HarnessV1NetworkSandboxSession {
    if (this.sessionState !== 'active' || this.sandboxSession == null) {
      throw new Error(
        `Harness session ${this.sessionId} has ended and cannot be reused.`,
      );
    }
    return this.sandboxSession;
  }

  /**
   * Working directory the agent runs in for this session. Used to strip the
   * prefix from absolute paths in stream events before they reach consumers.
   *
   * @internal — accessed by session turn drivers.
   */
  getSessionWorkDir(): string {
    return this.sessionWorkDir;
  }

  promptTurn<TOOLS extends ToolSet, RUNTIME_CONTEXT extends Context>(options: {
    prompt: HarnessAgentPrompt;
    instructions: string | undefined;
    tools: TOOLS;
    activeTools: ToolSet;
    toolSpecs: HarnessAgentToolSpec[];
    builtinToolFiltering: HarnessV1BuiltinToolFiltering | undefined;
    runtimeContext: RUNTIME_CONTEXT;
    abortSignal: AbortSignal | undefined;
    telemetry: TelemetryOptions | undefined;
  }): HarnessAgentTurnResult<TOOLS, RUNTIME_CONTEXT> {
    const session = this.requireReusableSession();
    this.requirePromptableTurn();
    const sandboxSession = this.getSandboxSession();
    const turnId = this.startTrackedTurn();
    try {
      const turn = runPrompt<TOOLS, RUNTIME_CONTEXT>({
        harness: this.harness,
        session,
        prompt: options.prompt,
        instructions: options.instructions,
        tools: options.tools,
        activeTools: options.activeTools,
        toolSpecs: options.toolSpecs,
        builtinToolFiltering: options.builtinToolFiltering,
        sandboxSession: sandboxSession.restricted(),
        sessionWorkDir: this.sessionWorkDir,
        runtimeContext: options.runtimeContext,
        abortSignal: options.abortSignal,
        telemetry: options.telemetry,
        toolApproval: this.toolApproval,
        pendingToolApprovals: this.getPendingToolApprovals(),
        onPendingToolApproval: approval => {
          this.pendingToolApprovals.set(approval.approvalId, approval);
          this.markAwaitingApprovalIfActive();
        },
        onToolApprovalSettled: approvalId => {
          this.pendingToolApprovals.delete(approvalId);
        },
        onTurnFinished: () => {
          this.finishTrackedTurn({ turnId });
        },
      });
      this.trackTurnCompletion({ done: turn.done, turnId });
      return turn;
    } catch (error) {
      this.finishTrackedTurn({ turnId });
      throw error;
    }
  }

  continueTurn<
    TOOLS extends ToolSet,
    RUNTIME_CONTEXT extends Context,
  >(options: {
    instructions: string | undefined;
    tools: TOOLS;
    activeTools: ToolSet;
    toolSpecs: HarnessAgentToolSpec[];
    builtinToolFiltering: HarnessV1BuiltinToolFiltering | undefined;
    runtimeContext: RUNTIME_CONTEXT;
    abortSignal: AbortSignal | undefined;
    telemetry: TelemetryOptions | undefined;
    toolApprovalContinuations?:
      | readonly HarnessAgentToolApprovalContinuation[]
      | undefined;
  }): HarnessAgentTurnResult<TOOLS, RUNTIME_CONTEXT> {
    const session = this.requireReusableSession();
    this.requireContinuableTurn();
    const sandboxSession = this.getSandboxSession();
    const turnId = this.startTrackedTurn();
    try {
      const turn = runPrompt<TOOLS, RUNTIME_CONTEXT>({
        harness: this.harness,
        session,
        mode: 'continue',
        instructions: options.instructions,
        tools: options.tools,
        activeTools: options.activeTools,
        toolSpecs: options.toolSpecs,
        builtinToolFiltering: options.builtinToolFiltering,
        sandboxSession: sandboxSession.restricted(),
        sessionWorkDir: this.sessionWorkDir,
        runtimeContext: options.runtimeContext,
        abortSignal: options.abortSignal,
        telemetry: options.telemetry,
        toolApproval: this.toolApproval,
        pendingToolApprovals: this.getPendingToolApprovals(),
        toolApprovalContinuations: options.toolApprovalContinuations,
        onPendingToolApproval: approval => {
          this.pendingToolApprovals.set(approval.approvalId, approval);
          this.markAwaitingApprovalIfActive();
        },
        onToolApprovalSettled: approvalId => {
          this.pendingToolApprovals.delete(approvalId);
        },
        onTurnFinished: () => {
          this.finishTrackedTurn({ turnId });
        },
      });
      this.trackTurnCompletion({ done: turn.done, turnId });
      return turn;
    } catch (error) {
      this.finishTrackedTurn({ turnId });
      throw error;
    }
  }

  /**
   * Ask the underlying runtime to compact its context. The runtime performs
   * the compaction itself; when it completes, a `compaction` part appears on
   * the active (or next) turn's stream. Safe to call between turns for
   * runtimes whose compaction is session-scoped (e.g. Pi).
   *
   * Throws `HarnessCapabilityUnsupportedError` for harnesses that cannot
   * trigger compaction manually (e.g. Codex, which still auto-compacts under
   * the hood). Throws if the session has ended.
   */
  async compact(customInstructions?: string): Promise<void> {
    await this.requireReusableSession().doCompact(customInstructions);
  }

  /**
   * Park the session, returning a payload the caller can persist and later
   * pass to `agent.createSession({ sessionId, resumeFrom })` to reconnect.
   * The runtime and sandbox keep running; this local session handle becomes
   * unusable.
   */
  async detach(): Promise<HarnessAgentResumeSessionState> {
    if (this.sessionState !== 'active' || this.underlyingSession == null) {
      throw new Error(
        `Harness session ${this.sessionId} is not active and cannot be detached.`,
      );
    }
    const session = this.underlyingSession;
    try {
      if (this.turnState !== 'idle') {
        return this.toResumeStateWithContinuation({
          continueFrom: await this.suspendCurrentTurn({ session }),
        });
      }
      const raw = await session.doDetach();
      const validated = await validateLifecycleStateData({
        harness: this.harness,
        state: raw,
        expectedType: 'resume-session',
      });
      return validated;
    } finally {
      this.endLocalHandle({
        sessionState: 'detached',
        releasePortLease: false,
      });
    }
  }

  /**
   * Persist enough state to resume later, then stop the runtime and sandbox.
   * Returns the resume state for a future
   * `agent.createSession({ sessionId, resumeFrom })` call.
   */
  async stop(): Promise<HarnessAgentResumeSessionState> {
    if (this.sessionState !== 'active' || this.underlyingSession == null) {
      throw new Error(
        `Harness session ${this.sessionId} is not active and cannot be stopped.`,
      );
    }
    const session = this.underlyingSession;
    const sandboxSession = this.getSandboxSession();
    try {
      if (this.turnState !== 'idle') {
        return this.toResumeStateWithContinuation({
          continueFrom: await this.suspendCurrentTurn({ session }),
        });
      }
      const raw = await session.doStop();
      const validated = await validateLifecycleStateData({
        harness: this.harness,
        state: raw,
        expectedType: 'resume-session',
      });
      return validated;
    } finally {
      this.endLocalHandle({
        sessionState: 'stopped',
        releasePortLease: true,
      });
      await Promise.resolve(sandboxSession.stop()).catch(() => {});
    }
  }

  /**
   * Stop the runtime and discard resumability. The sandbox is destroyed when
   * the provider supports destruction; otherwise it is stopped.
   */
  async destroy(): Promise<void> {
    if (this.sessionState !== 'active') return;
    const session = this.underlyingSession;
    const sandboxSession = this.getSandboxSession();
    this.endLocalHandle({ sessionState: 'destroyed', releasePortLease: true });
    if (session != null) {
      await Promise.resolve(session.doDestroy()).catch(() => {});
    }
    await Promise.resolve(
      sandboxSession.destroy?.() ?? sandboxSession.stop(),
    ).catch(() => {});
  }

  /**
   * Gracefully freeze the active turn at the slice boundary and return the
   * continuation payload, **leaving the sandbox/runtime running** so the next
   * process can continue. Resolves once the in-flight `stream()` /
   * `continueStream()` has cleanly wound down at a precise cursor (see
   * `doSuspendTurn`).
   *
   * After this call the session is detached. This in-process handle no
   * longer drives turns; a future slice creates a fresh session from the
   * returned state. The sandbox is **not** stopped and no port lease is
   * released, because bridge-backed adapters may still have a live bridge on
   * that port.
   */
  async suspendTurn(): Promise<HarnessAgentContinueTurnState> {
    if (this.sessionState !== 'active' || this.underlyingSession == null) {
      throw new Error(
        `Harness session ${this.sessionId} is not active and cannot be suspended.`,
      );
    }
    if (this.turnState === 'idle') {
      throw new Error(
        `Harness session ${this.sessionId} has no unfinished turn to suspend.`,
      );
    }
    const session = this.underlyingSession;
    try {
      return await this.suspendCurrentTurn({ session });
    } finally {
      this.endLocalHandle({
        sessionState: 'detached',
        releasePortLease: false,
      });
    }
  }

  private getPendingToolApprovals(): readonly HarnessAgentPendingToolApproval[] {
    return Array.from(this.pendingToolApprovals.values());
  }

  private addPendingToolApprovals(
    state: HarnessAgentContinueTurnState,
  ): HarnessAgentContinueTurnState {
    const pendingToolApprovals = this.getPendingToolApprovals();
    if (pendingToolApprovals.length === 0) {
      return {
        type: state.type,
        harnessId: state.harnessId,
        specificationVersion: state.specificationVersion,
        data: state.data,
      };
    }
    return {
      ...state,
      pendingToolApprovals,
    };
  }

  private async suspendCurrentTurn(options: {
    session: HarnessAgentAdapterSession;
  }): Promise<HarnessAgentContinueTurnState> {
    const raw = await options.session.doSuspendTurn();
    const validated = await validateLifecycleStateData({
      harness: this.harness,
      state: raw,
      expectedType: 'continue-turn',
    });
    this.turnState = 'suspended';
    return this.addPendingToolApprovals(validated);
  }

  private toResumeStateWithContinuation(options: {
    continueFrom: HarnessAgentContinueTurnState;
  }): HarnessAgentResumeSessionState {
    const { continueFrom } = options;
    return {
      type: 'resume-session',
      harnessId: continueFrom.harnessId,
      specificationVersion: continueFrom.specificationVersion,
      data: continueFrom.data,
      continueFrom,
    };
  }

  private requirePromptableTurn(): void {
    if (this.turnState === 'idle') return;
    if (this.turnState === 'running') {
      throw new Error(
        `Harness session ${this.sessionId} already has a turn in progress.`,
      );
    }
    throw new Error(
      `Harness session ${this.sessionId} has an unfinished turn and must be continued before accepting a new prompt.`,
    );
  }

  private requireContinuableTurn(): void {
    if (
      this.turnState === 'awaiting-approval' ||
      this.turnState === 'suspended'
    ) {
      return;
    }
    if (this.turnState === 'running') {
      throw new Error(
        `Harness session ${this.sessionId} already has a turn in progress.`,
      );
    }
    throw new Error(
      `Harness session ${this.sessionId} has no unfinished turn to continue.`,
    );
  }

  private markAwaitingApprovalIfActive(): void {
    if (this.sessionState === 'active') {
      this.turnState = 'awaiting-approval';
    }
  }

  private startTrackedTurn(): number {
    const turnId = ++this.turnSequence;
    this.activeTurnSequence = turnId;
    this.turnState = 'running';
    return turnId;
  }

  private trackTurnCompletion(options: {
    done: Promise<void>;
    turnId: number;
  }): void {
    void Promise.resolve(options.done)
      .finally(() => {
        this.finishTrackedTurn({ turnId: options.turnId });
      })
      .catch(() => {});
  }

  private finishTrackedTurn(options: { turnId: number }): void {
    if (this.sessionState !== 'active') return;
    if (this.activeTurnSequence !== options.turnId) return;
    this.turnState =
      this.pendingToolApprovals.size > 0 ? 'awaiting-approval' : 'idle';
  }

  private endLocalHandle(options: {
    sessionState: Exclude<HarnessAgentSessionState, 'active'>;
    releasePortLease: boolean;
  }): void {
    this.sessionState = options.sessionState;
    this.underlyingSession = undefined;
    this.sandboxSession = undefined;
    if (options.releasePortLease) {
      this.releasePortLease();
    }
  }

  private releasePortLease(): void {
    if (this.leasedBridgePort == null) return;
    releaseBridgePort({
      poolKey: this.sandboxProvider,
      sessionId: this.sessionId,
    });
    this.leasedBridgePort = undefined;
  }

  private requireReusableSession(): HarnessAgentAdapterSession {
    if (this.sessionState !== 'active' || this.underlyingSession == null) {
      throw new Error(
        `Harness session ${this.sessionId} has ended and cannot be reused.`,
      );
    }
    return this.underlyingSession;
  }
}
