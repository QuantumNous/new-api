import type {
  Context,
  InferToolContext,
  InferToolInput,
  InferToolSetContext,
  MaybePromiseLike,
  ModelMessage,
  ToolExecutionOptions,
  ToolSet,
} from '@ai-sdk/provider-utils';
import type { TypedToolCall } from './tool-call';

/**
 * The approval status of a tool configuration. This can be one of the following:
 *
 * - 'not-applicable': The tool does not require approval.
 * - 'approved': The tool is automatically approved.
 * - 'denied': The tool is automatically denied.
 * - 'user-approval': The tool requires user approval.
 *
 * In addition to the string statuses, you can also use object statuses with a reason property.
 *
 * `undefined` is treated as the `not-applicable` status.
 */
export type ToolApprovalStatus =
  | undefined
  | 'not-applicable'
  | 'approved'
  | 'denied'
  | 'user-approval'
  | { type: 'not-applicable'; reason?: never }
  | { type: 'approved'; reason?: string }
  | { type: 'denied'; reason?: string }
  | { type: 'user-approval'; reason?: never };

/**
 * Function that is called to determine if the tool needs approval before it can be executed.
 *
 * Return `undefined` for the same effect as the `not-applicable` status.
 */
// Parameters are similar to ToolExecuteFunction (except for the abort signal)
export type SingleToolApprovalFunction<
  INPUT,
  TOOL_CONTEXT extends Context | unknown | never,
  RUNTIME_CONTEXT extends Context | unknown | never,
> = (
  input: INPUT,
  options: Omit<
    ToolExecutionOptions<TOOL_CONTEXT>,
    'abortSignal' | 'context'
  > & {
    toolContext: TOOL_CONTEXT;
    runtimeContext: RUNTIME_CONTEXT;
  },
) => MaybePromiseLike<ToolApprovalStatus>;

/**
 * Function that is called to determine if a tool call needs approval before it can be executed.
 *
 * Return `undefined` for the same effect as the `not-applicable` status.
 */
export type GenericToolApprovalFunction<
  TOOLS extends ToolSet,
  TOOLS_CONTEXT extends InferToolSetContext<TOOLS>,
  RUNTIME_CONTEXT extends Context | unknown | never,
> = (options: {
  /**
   * The tool call that needs approval.
   */
  toolCall: TypedToolCall<TOOLS>;

  /**
   * All tools that are available for the model to call.
   */
  tools: TOOLS | undefined;

  /**
   * Tool context for all tools that are available for the model to call.
   */
  toolsContext: TOOLS_CONTEXT;

  /**
   * Runtime context.
   */
  runtimeContext: RUNTIME_CONTEXT;

  /**
   * Messages that were sent to the language model to initiate the response that contained the tool call.
   * The messages **do not** include the system prompt nor the assistant response that contained the tool call.
   */
  messages: ModelMessage[];
}) => MaybePromiseLike<ToolApprovalStatus>;

/**
 * Configure whether individual tools require approval before they can run.
 *
 * You can either use a generic function that is called for all tool calls,
 * or you can use a per-tool function.
 *
 * For the per-tool functions, each tool can be assigned either an approval status
 * or a function that produces an approval status at runtime.
 *
 * The approval status can be one of the following:
 * - 'not-applicable': The tool does not require approval.
 * - 'approved': The tool is automatically approved.
 * - 'denied': The tool is automatically denied.
 * - 'user-approval': The tool requires user approval.
 *
 * In addition to the string statuses, you can also use object statuses with a reason property.
 */
export type ToolApprovalConfiguration<
  TOOLS extends ToolSet,
  RUNTIME_CONTEXT extends Context | unknown | never,
> =
  | GenericToolApprovalFunction<
      TOOLS,
      InferToolSetContext<TOOLS>,
      RUNTIME_CONTEXT
    >
  | {
      [key in keyof TOOLS]?:
        | ToolApprovalStatus
        | SingleToolApprovalFunction<
            InferToolInput<TOOLS[key]>,
            InferToolContext<TOOLS[key]>,
            RUNTIME_CONTEXT
          >;
    };
