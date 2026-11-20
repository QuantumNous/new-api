import type {
  InferToolContext,
  ModelMessage,
  ToolSet,
} from '@ai-sdk/provider-utils';
import type { Callback } from '../util/callback';
import type { DynamicToolCall, StaticToolCall } from './tool-call';
import type { ToolOutput } from './tool-output';
import type { ValueOf } from '../util/value-of';

/**
 * Resolves a single tool's context type, falling back to `undefined` when the
 * tool does not declare a `contextSchema`.
 */
type ToolContextFor<TOOL extends ToolSet[keyof ToolSet]> = [
  InferToolContext<TOOL>,
] extends [never]
  ? undefined
  : InferToolContext<TOOL>;

type BaseToolExecutionStartFields = {
  /** Unique identifier for this generation call, used to correlate events. */
  readonly callId: string;

  /**
   * Messages that were sent to the language model to initiate the response that contained the tool call.
   * The messages **do not** include the system prompt nor the assistant response that contained the tool call.
   */
  readonly messages: ModelMessage[];
};

/**
 * Precise start event union for statically known tools.
 *
 * Each union member ties a specific `toolCall.toolName` to that tool's
 * validated `toolContext` type.
 */
type StaticToolExecutionStartEvent<TOOLS extends ToolSet> = ValueOf<{
  [NAME in keyof TOOLS]: BaseToolExecutionStartFields & {
    readonly toolCall: Extract<StaticToolCall<TOOLS>, { toolName: NAME }>;
    readonly toolContext: ToolContextFor<TOOLS[NAME]>;
  };
}>;

/**
 * Start event shape for dynamic or untyped tool calls.
 */
type DynamicToolExecutionStartEvent = BaseToolExecutionStartFields & {
  readonly toolCall: DynamicToolCall;
  readonly toolContext: unknown;
};

/**
 * Broad start event shape used for the default `ToolSet` specialization.
 *
 * This keeps generic collectors ergonomic when the caller is not working with
 * a concrete tool set and therefore cannot benefit from per-tool narrowing.
 */
type WidenedToolExecutionStartEvent = BaseToolExecutionStartFields & {
  readonly toolCall: StaticToolCall<ToolSet> | DynamicToolCall;
  readonly toolContext: unknown;
};

/**
 * Event passed to the `onToolExecutionStart` callback.
 *
 * Called when a tool execution begins, before the tool's `execute` function is invoked.
 */
export type ToolExecutionStartEvent<TOOLS extends ToolSet = ToolSet> = [
  ToolSet,
] extends [TOOLS]
  ? WidenedToolExecutionStartEvent
  : StaticToolExecutionStartEvent<TOOLS> | DynamicToolExecutionStartEvent;

type BaseToolExecutionEndFields = {
  /** Unique identifier for this generation call, used to correlate events. */
  readonly callId: string;

  /** Execution time of the tool call in milliseconds. */
  readonly toolExecutionMs: number;

  /**
   * Messages that were sent to the language model to initiate the response that contained the tool call.
   * The messages **do not** include the system prompt nor the assistant response that contained the tool call.
   */
  readonly messages: ModelMessage[];
};

/**
 * Precise end event union for statically known tools.
 *
 * Each union member preserves the link between `toolCall.toolName`, the
 * corresponding validated `toolContext`, and the tool execution result.
 */
type StaticToolExecutionEndEvent<TOOLS extends ToolSet> = ValueOf<{
  [NAME in keyof TOOLS]: BaseToolExecutionEndFields & {
    readonly toolCall: Extract<StaticToolCall<TOOLS>, { toolName: NAME }>;
    readonly toolContext: ToolContextFor<TOOLS[NAME]>;
    readonly toolOutput: ToolOutput<TOOLS>;
  };
}>;

/**
 * End event shape for dynamic or untyped tool calls.
 */
type DynamicToolExecutionEndEvent<TOOLS extends ToolSet> =
  BaseToolExecutionEndFields & {
    readonly toolCall: DynamicToolCall;
    readonly toolContext: unknown;
    readonly toolOutput: ToolOutput<TOOLS>;
  };

/**
 * Broad end event shape used for the default `ToolSet` specialization.
 *
 * This provides an assignable catch-all event type for generic consumers while
 * the concrete-tool specialization retains full per-tool narrowing.
 */
type WidenedToolExecutionEndEvent = BaseToolExecutionEndFields & {
  readonly toolCall: StaticToolCall<ToolSet> | DynamicToolCall;
  readonly toolContext: unknown;
  readonly toolOutput: ToolOutput<ToolSet>;
};

/**
 * Event passed to the `onToolExecutionEnd` callback.
 *
 * Called when a tool execution completes, either successfully or with an error.
 * Uses the `toolOutput.type` discriminator to distinguish success and error.
 */
export type ToolExecutionEndEvent<TOOLS extends ToolSet = ToolSet> = [
  ToolSet,
] extends [TOOLS]
  ? WidenedToolExecutionEndEvent
  : StaticToolExecutionEndEvent<TOOLS> | DynamicToolExecutionEndEvent<TOOLS>;

/**
 * Callback that is set using the `onToolExecutionStart` option.
 *
 * Called when a tool execution begins, before the tool's `execute` function is invoked.
 * Use this for logging tool invocations, tracking tool usage, or pre-execution validation.
 *
 * @param event - The event object containing tool call information.
 */
export type OnToolExecutionStartCallback<TOOLS extends ToolSet = ToolSet> =
  Callback<ToolExecutionStartEvent<TOOLS>>;

/**
 * Callback that is set using the `onToolExecutionEnd` option.
 *
 * Called when a tool execution completes, either successfully or with an error.
 * Use this for logging tool results, tracking execution time, or error handling.
 *
 * The event uses a discriminated union on `toolOutput.type`:
 * - When `toolOutput.type === 'tool-result'`: `toolOutput.output` contains the tool result.
 * - When `toolOutput.type === 'tool-error'`: `toolOutput.error` contains the error.
 *
 * @param event - The event object containing tool call result information.
 */
export type OnToolExecutionEndCallback<TOOLS extends ToolSet = ToolSet> =
  Callback<ToolExecutionEndEvent<TOOLS>>;

/** @deprecated Use `ToolExecutionStartEvent` instead. */
export type OnToolCallStartEvent<TOOLS extends ToolSet = ToolSet> =
  ToolExecutionStartEvent<TOOLS>;

/** @deprecated Use `ToolExecutionEndEvent` instead. */
export type OnToolCallFinishEvent<TOOLS extends ToolSet = ToolSet> =
  ToolExecutionEndEvent<TOOLS>;
