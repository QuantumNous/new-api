import type {
  HarnessV1ContinueTurnState,
  HarnessV1Prompt,
  HarnessV1ResumeSessionState,
} from '@ai-sdk/harness';
import type { HarnessAgentSession } from '@ai-sdk/harness/agent';
import type {
  HarnessWorkflowModelMessage,
  HarnessWorkflowSerializedChunk,
  HarnessWorkflowState,
  HarnessWorkflowStreamContext,
  HarnessWorkflowUsageSummary,
} from './harness-workflow-state';

/** The non-string arm of {@link HarnessV1Prompt} — a single `UserModelMessage`. */
type HarnessV1UserMessage = Exclude<HarnessV1Prompt, string>;

/*
 * Default wall-clock budget for one slice, in seconds.
 *
 * Vercel Fluid Compute recycles a function instance at ~800s, forcing it to
 * reconnect; freezing the slice at 750s lands just before that with a small
 * safety buffer, so the next invocation reattaches to the still-running sandbox
 * rather than being torn down mid-turn.
 */
const DEFAULT_SLICE_TIMEOUT_SECONDS = 750;

/** A UI-message-stream chunk. Kept structural so this package need not depend on `ai`. */
export interface HarnessWorkflowChunk {
  readonly type: string;
  readonly [key: string]: unknown;
}

/**
 * The subset of a harness `stream()` / `continueStream()` result the slice loop uses.
 * `StreamTextResult` satisfies it structurally.
 */
export interface HarnessWorkflowStreamResult {
  toUIMessageStream(): ReadableStream<HarnessWorkflowChunk>;
  readonly finishReason: PromiseLike<unknown>;
  readonly totalUsage: PromiseLike<unknown>;
}

/**
 * The subset of `HarnessAgent` the slice loop drives. Declared structurally so
 * the engine is decoupled from the concrete agent generics and easy to mock.
 */
export interface HarnessWorkflowAgent {
  createSession(options?: {
    sessionId?: string;
    resumeFrom?: HarnessV1ResumeSessionState;
    continueFrom?: HarnessV1ContinueTurnState;
  }): Promise<HarnessAgentSession>;
  stream(
    options:
      | {
          session: HarnessAgentSession;
          /**
           * The new user turn. A string or an array of user messages — the shape
           * `HarnessAgent.stream` accepts (it collapses an array to its last user
           * entry). The engine passes the run's single {@link HarnessV1Prompt}.
           */
          prompt: string | HarnessV1UserMessage[];
          messages?: undefined;
        }
      | {
          session: HarnessAgentSession;
          prompt?: undefined;
          messages: HarnessWorkflowModelMessage[];
        },
  ): Promise<HarnessWorkflowStreamResult>;
  continueStream(options: {
    session: HarnessAgentSession;
  }): Promise<HarnessWorkflowStreamResult>;
}

export interface RunHarnessAgentSliceOptions {
  readonly agent: HarnessWorkflowAgent;
  readonly state: HarnessWorkflowState;
  /** Wall-clock budget for this slice. Defaults to {@link DEFAULT_SLICE_TIMEOUT_SECONDS}. */
  readonly sliceTimeoutSeconds?: number;
  /**
   * When the turn finishes, whether to destroy the sandbox. Defaults to `false`:
   * the session is parked or stopped and a fresh resume state is returned in
   * `resumeFrom`, so the next user turn reattaches to the same conversation
   * (multi-turn chat). Set `true` for a one-shot run that should release the
   * sandbox when the turn completes.
   */
  readonly destroyOnFinish?: boolean;
  /**
   * Where to write the turn's UI-message chunks. Defaults to the workflow's
   * output stream (`getWritable()` from `workflow`). Inject a stream in tests
   * to run the engine without a workflow runtime.
   */
  readonly writable?: WritableStream<HarnessWorkflowChunk>;
}

/**
 * Run one durable slice of a harness agent turn.
 *
 * Intended to be the body of a consumer's `'use step'`: it resumes (or starts)
 * the session, streams the turn's chunks to the workflow output, and races the
 * turn against a wall-clock budget. If the budget fires first it freezes the
 * turn with `session.suspendTurn()` (the sandbox keeps running) and returns a
 * `timed_out` state carrying continuation state for the next slice; if the
 * turn finishes first it returns a `finished` state with the result.
 *
 * The returned {@link HarnessWorkflowState} is serializable and is meant to be
 * the step's return value — the Workflow DevKit persists it as the durable
 * checkpoint between slices.
 */
export async function runHarnessAgentSlice(
  options: RunHarnessAgentSliceOptions,
): Promise<HarnessWorkflowState> {
  const { agent, state } = options;
  const sliceTimeoutSeconds =
    options.sliceTimeoutSeconds ?? DEFAULT_SLICE_TIMEOUT_SECONDS;
  const destroyOnFinish = options.destroyOnFinish ?? false;

  const session =
    state.continueFrom != null
      ? await agent.createSession({
          sessionId: state.sessionId,
          continueFrom: state.continueFrom,
        })
      : state.resumeFrom != null
        ? await agent.createSession({
            sessionId: state.sessionId,
            resumeFrom: state.resumeFrom,
          })
        : await agent.createSession({ sessionId: state.sessionId });

  let result: HarnessWorkflowStreamResult;
  try {
    result =
      state.messages != null
        ? await agent.stream({
            session,
            messages: state.messages,
          })
        : state.continueFrom != null
          ? await agent.continueStream({ session })
          : await agent.stream({
              session,
              prompt:
                typeof state.prompt === 'string'
                  ? state.prompt
                  : [state.prompt],
            });
  } catch (err) {
    await destroyQuietly(session);
    return {
      sessionId: state.sessionId,
      prompt: state.prompt,
      status: 'failed',
      ...(state.resumeFrom != null ? { resumeFrom: state.resumeFrom } : {}),
      ...(state.continueFrom != null
        ? { continueFrom: state.continueFrom }
        : {}),
      error: errorMessage(err),
    };
  }

  const writable = options.writable ?? (await resolveWorkflowWritable());
  const writer = writable.getWriter();
  const streamContext = createMutableStreamContext(state.streamContext);
  const slicePartState = createSlicePartState();

  let suspendPromise: Promise<HarnessV1ContinueTurnState> | undefined;
  const timer = setTimeout(() => {
    suspendPromise = session.suspendTurn();
  }, sliceTimeoutSeconds * 1000);
  (timer as { unref?: () => void }).unref?.();

  let sawError = false;
  // Tracks whether the writable was closed (only on a finished turn). The
  // `finally` then releases the lock only when we did NOT close, since closing
  // already releases it.
  let writerClosed = false;
  try {
    const reader = result.toUIMessageStream().getReader();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value == null) continue;
        /*
         * One continuous assistant message per user turn: the slice that starts
         * the turn keeps the opening `start`; slices that continue an already
         * suspended turn drop it. Intermediate `finish` chunks are dropped and
         * the loop writes a single terminal `finish` itself when the run
         * completes. A new user turn keeps its `start` so the UI renders it as
         * a fresh assistant message.
         */
        if (value.type === 'start' && state.continueFrom != null) continue;
        if (value.type === 'finish') continue;
        if (value.type === 'error') {
          const errorText = (value as { errorText?: unknown }).errorText;
          /*
           * When a suspend is in flight we tore the turn down at the slice
           * boundary, so an *abort* error is the expected consequence — swallow
           * it (surfacing it would replace the streamed content with an error,
           * and the next slice continues the turn). Any non-abort error is
           * unanticipated and must NOT be silenced: surface it and fail the
           * slice, even mid-suspend.
           */
          if (suspendPromise != null && isAbortError(errorText)) {
            continue;
          }
          sawError = true;
        }
        await writeWorkflowChunk({
          chunk: value,
          writer,
          streamContext,
          slicePartState,
        });
      }
    } finally {
      clearTimeout(timer);
      reader.releaseLock();
    }

    // A non-abort error (anything `sawError` survived the abort filter for) is a
    // real failure and takes priority over the budget — don't let `timed_out`
    // mask it. (Abort errors during suspend were already filtered above.)
    if (sawError) {
      if (suspendPromise != null) await suspendPromise.catch(() => {});
      await destroyQuietly(session);
      return {
        sessionId: state.sessionId,
        prompt: state.prompt,
        status: 'failed',
        ...(state.resumeFrom != null ? { resumeFrom: state.resumeFrom } : {}),
        ...(state.continueFrom != null
          ? { continueFrom: state.continueFrom }
          : {}),
        error: 'harness turn emitted an error',
      };
    }

    // Budget fired: the turn keeps running in the sandbox; persist the cursor
    // so the next slice attaches and continues the same in-flight turn.
    if (suspendPromise != null) {
      const continueFrom = await suspendPromise;
      await closeOpenSliceParts({
        writer,
        streamContext,
        slicePartState,
      });
      return {
        sessionId: state.sessionId,
        prompt: state.prompt,
        status: 'timed_out',
        continueFrom,
        ...serializeStreamContextField(streamContext),
      };
    }

    const [finishReason, usage] = await Promise.all([
      Promise.resolve(result.finishReason).catch(() => undefined),
      Promise.resolve(result.totalUsage).catch(() => undefined),
    ]);
    const normalizedFinishReason = toFinishReasonString(finishReason);

    if (normalizedFinishReason === 'tool-calls') {
      const continueFrom = await session.suspendTurn();
      await writer.write({ type: 'finish', finishReason: 'tool-calls' });
      await writer.close();
      writerClosed = true;
      return {
        sessionId: state.sessionId,
        prompt: state.prompt,
        status: 'awaiting_tool_approval',
        continueFrom,
      };
    }

    // The turn finished on its own: write the single terminal `finish` for the
    // UI message, then CLOSE the writable. Closing matters: the workflow output
    // stream (`getWritable()`) is what the run's `readable` is fed from, and the
    // DevKit only marks that run stream "done" when the writable is closed — a
    // released-but-open writer leaves it open forever, so a consumer piping
    // `run.readable` into a UI-message-stream response never receives the
    // terminal close and the client stays "streaming" indefinitely. (`timed_out`
    // and `failed` deliberately do NOT close — the next slice keeps writing, or
    // the failure propagates.)
    await writer.write({ type: 'finish' });
    await writer.close();
    writerClosed = true;

    /*
     * Capture resume state for the *next user turn* before ending this local
     * session handle. `detach()` parks the session without stopping the sandbox;
     * bridge-backed sessions usually resume by attach/replay, while
     * host-resident sessions may resume by rerun. A one-shot consumer opts into
     * `destroyOnFinish` to destroy the sandbox instead.
     */
    let resumeFrom = state.resumeFrom;
    if (destroyOnFinish) {
      await destroyQuietly(session);
      resumeFrom = undefined;
    } else {
      resumeFrom = await session.detach().catch(() => state.resumeFrom);
    }

    return {
      sessionId: state.sessionId,
      prompt: state.prompt,
      status: 'finished',
      ...(resumeFrom != null ? { resumeFrom } : {}),
      finalResult: {
        sessionId: state.sessionId,
        finishReason: normalizedFinishReason,
        usage: toUsageSummary(usage),
      },
    };
  } finally {
    if (!writerClosed) writer.releaseLock();
  }
}

type MutableStreamContext = {
  activeTextParts: Record<string, HarnessWorkflowSerializedChunk>;
  activeReasoningParts: Record<string, HarnessWorkflowSerializedChunk>;
  pendingToolInputs: Record<string, HarnessWorkflowSerializedChunk>;
};

type SlicePartState = {
  openedTextParts: Set<string>;
  openedReasoningParts: Set<string>;
  writtenToolInputs: Set<string>;
};

function createMutableStreamContext(
  context: HarnessWorkflowStreamContext | undefined,
): MutableStreamContext {
  return {
    activeTextParts: { ...(context?.activeTextParts ?? {}) },
    activeReasoningParts: { ...(context?.activeReasoningParts ?? {}) },
    pendingToolInputs: { ...(context?.pendingToolInputs ?? {}) },
  };
}

function createSlicePartState(): SlicePartState {
  return {
    openedTextParts: new Set(),
    openedReasoningParts: new Set(),
    writtenToolInputs: new Set(),
  };
}

async function writeWorkflowChunk(options: {
  chunk: HarnessWorkflowChunk;
  writer: WritableStreamDefaultWriter<HarnessWorkflowChunk>;
  streamContext: MutableStreamContext;
  slicePartState: SlicePartState;
}): Promise<void> {
  await writeRequiredPrelude(options);
  await options.writer.write(options.chunk);
  recordWorkflowChunk(options);
}

async function writeRequiredPrelude(options: {
  chunk: HarnessWorkflowChunk;
  writer: WritableStreamDefaultWriter<HarnessWorkflowChunk>;
  streamContext: MutableStreamContext;
  slicePartState: SlicePartState;
}): Promise<void> {
  const { chunk, writer, streamContext, slicePartState } = options;
  const id = stringProperty({ chunk, key: 'id' });

  if (
    (chunk.type === 'text-delta' || chunk.type === 'text-end') &&
    id != null &&
    streamContext.activeTextParts[id] != null &&
    !slicePartState.openedTextParts.has(id)
  ) {
    await writer.write(streamContext.activeTextParts[id]);
    slicePartState.openedTextParts.add(id);
  }

  if (
    (chunk.type === 'reasoning-delta' || chunk.type === 'reasoning-end') &&
    id != null &&
    streamContext.activeReasoningParts[id] != null &&
    !slicePartState.openedReasoningParts.has(id)
  ) {
    await writer.write(streamContext.activeReasoningParts[id]);
    slicePartState.openedReasoningParts.add(id);
  }

  const toolCallId = stringProperty({ chunk, key: 'toolCallId' });
  if (
    toolCallId != null &&
    needsToolInputPrelude(chunk) &&
    streamContext.pendingToolInputs[toolCallId] != null &&
    !slicePartState.writtenToolInputs.has(toolCallId)
  ) {
    await writer.write(streamContext.pendingToolInputs[toolCallId]);
    slicePartState.writtenToolInputs.add(toolCallId);
  }
}

function recordWorkflowChunk(options: {
  chunk: HarnessWorkflowChunk;
  streamContext: MutableStreamContext;
  slicePartState: SlicePartState;
}): void {
  const { chunk, streamContext, slicePartState } = options;
  const id = stringProperty({ chunk, key: 'id' });
  const toolCallId = stringProperty({ chunk, key: 'toolCallId' });

  if (chunk.type === 'text-start' && id != null) {
    streamContext.activeTextParts[id] = cloneChunk(chunk);
    slicePartState.openedTextParts.add(id);
    return;
  }

  if (chunk.type === 'text-end' && id != null) {
    delete streamContext.activeTextParts[id];
    slicePartState.openedTextParts.delete(id);
    return;
  }

  if (chunk.type === 'reasoning-start' && id != null) {
    streamContext.activeReasoningParts[id] = cloneChunk(chunk);
    slicePartState.openedReasoningParts.add(id);
    return;
  }

  if (chunk.type === 'reasoning-end' && id != null) {
    delete streamContext.activeReasoningParts[id];
    slicePartState.openedReasoningParts.delete(id);
    return;
  }

  if (chunk.type === 'tool-input-available' && toolCallId != null) {
    streamContext.pendingToolInputs[toolCallId] = cloneChunk(chunk);
    slicePartState.writtenToolInputs.add(toolCallId);
    return;
  }

  if (chunk.type === 'tool-input-error' && toolCallId != null) {
    delete streamContext.pendingToolInputs[toolCallId];
    slicePartState.writtenToolInputs.add(toolCallId);
    return;
  }

  if (
    (chunk.type === 'tool-output-error' ||
      chunk.type === 'tool-output-denied' ||
      (chunk.type === 'tool-output-available' &&
        (chunk as { preliminary?: unknown }).preliminary !== true)) &&
    toolCallId != null
  ) {
    delete streamContext.pendingToolInputs[toolCallId];
  }
}

async function closeOpenSliceParts(options: {
  writer: WritableStreamDefaultWriter<HarnessWorkflowChunk>;
  streamContext: MutableStreamContext;
  slicePartState: SlicePartState;
}): Promise<void> {
  const { writer, streamContext, slicePartState } = options;

  for (const id of slicePartState.openedTextParts) {
    if (streamContext.activeTextParts[id] != null) {
      await writer.write({ type: 'text-end', id });
    }
  }
  slicePartState.openedTextParts.clear();

  for (const id of slicePartState.openedReasoningParts) {
    if (streamContext.activeReasoningParts[id] != null) {
      await writer.write({ type: 'reasoning-end', id });
    }
  }
  slicePartState.openedReasoningParts.clear();
}

function serializeStreamContextField(context: MutableStreamContext): {
  streamContext?: HarnessWorkflowStreamContext;
} {
  const streamContext: HarnessWorkflowStreamContext = {
    ...(Object.keys(context.activeTextParts).length > 0
      ? { activeTextParts: context.activeTextParts }
      : {}),
    ...(Object.keys(context.activeReasoningParts).length > 0
      ? { activeReasoningParts: context.activeReasoningParts }
      : {}),
    ...(Object.keys(context.pendingToolInputs).length > 0
      ? { pendingToolInputs: context.pendingToolInputs }
      : {}),
  };
  return Object.keys(streamContext).length > 0 ? { streamContext } : {};
}

function needsToolInputPrelude(chunk: HarnessWorkflowChunk): boolean {
  return (
    chunk.type === 'tool-approval-request' ||
    chunk.type === 'tool-output-available' ||
    chunk.type === 'tool-output-error' ||
    chunk.type === 'tool-output-denied'
  );
}

function stringProperty(options: {
  chunk: HarnessWorkflowChunk;
  key: string;
}): string | undefined {
  const value = options.chunk[options.key];
  return typeof value === 'string' ? value : undefined;
}

function cloneChunk(
  chunk: HarnessWorkflowChunk,
): HarnessWorkflowSerializedChunk {
  return { ...chunk };
}

/**
 * Resolve the workflow's default output stream lazily, so importing this module
 * never requires the `workflow` runtime (tests inject their own `writable`).
 */
async function resolveWorkflowWritable(): Promise<
  WritableStream<HarnessWorkflowChunk>
> {
  const { getWritable } = (await import('workflow')) as {
    getWritable: <T>() => WritableStream<T>;
  };
  return getWritable<HarnessWorkflowChunk>();
}

async function destroyQuietly(session: HarnessAgentSession): Promise<void> {
  await session.destroy().catch(() => {});
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Whether an error (or UI `error` part's `errorText`) is an abort — the
 * expected consequence of `suspendTurn()` tearing the turn down at a slice
 * boundary. Only these are safe to swallow during a suspend; any other error is
 * unanticipated and must surface.
 */
function isAbortError(value: unknown): boolean {
  if (value == null) return false;
  if (
    typeof value === 'object' &&
    (value as { name?: unknown }).name === 'AbortError'
  ) {
    return true;
  }
  const text =
    typeof value === 'string'
      ? value
      : value instanceof Error
        ? value.message
        : String(value);
  return /\baborted\b|AbortError|operation was aborted/i.test(text);
}

function toFinishReasonString(finishReason: unknown): string {
  if (typeof finishReason === 'string') return finishReason;
  if (
    finishReason != null &&
    typeof finishReason === 'object' &&
    typeof (finishReason as { unified?: unknown }).unified === 'string'
  ) {
    return (finishReason as { unified: string }).unified;
  }
  return 'stop';
}

function toUsageSummary(
  usage: unknown,
): HarnessWorkflowUsageSummary | undefined {
  if (usage == null || typeof usage !== 'object') return undefined;
  const u = usage as {
    inputTokens?: { total?: number };
    outputTokens?: { total?: number };
  };
  const inputTokens = u.inputTokens?.total;
  const outputTokens = u.outputTokens?.total;
  if (inputTokens == null && outputTokens == null) return undefined;
  return {
    ...(inputTokens != null ? { inputTokens } : {}),
    ...(outputTokens != null ? { outputTokens } : {}),
  };
}
