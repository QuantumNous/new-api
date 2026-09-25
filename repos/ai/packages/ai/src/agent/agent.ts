import type {
  Arrayable,
  Context,
  Experimental_SandboxSession as SandboxSession,
  ModelMessage,
  ToolSet,
} from '@ai-sdk/provider-utils';
import type {
  GenerateTextOnEndCallback,
  GenerateTextOnStartCallback,
  GenerateTextOnStepEndCallback,
  GenerateTextOnStepFinishCallback,
  GenerateTextOnStepStartCallback,
} from '../generate-text/generate-text-events';
import type { GenerateTextResult } from '../generate-text/generate-text-result';
import type { Output } from '../generate-text/output';
import type { StreamTextTransform } from '../generate-text/stream-text';
import type { StreamTextResult } from '../generate-text/stream-text-result';
import type {
  OnToolExecutionEndCallback,
  OnToolExecutionStartCallback,
} from '../generate-text/tool-execution-events';
import type { TimeoutConfiguration } from '../prompt/request-options';

/**
 * Parameters for calling an agent.
 */
export type AgentCallParameters<
  CALL_OPTIONS,
  TOOLS extends ToolSet = {},
  RUNTIME_CONTEXT extends Context = Context,
> = ([CALL_OPTIONS] extends [never]
  ? { options?: never }
  : { options: CALL_OPTIONS }) &
  (
    | {
        /**
         * A prompt. It can be either a text prompt or a list of messages.
         *
         * You can either use `prompt` or `messages` but not both.
         */
        prompt: string | Array<ModelMessage>;

        /**
         * A list of messages.
         *
         * You can either use `prompt` or `messages` but not both.
         */
        messages?: never;
      }
    | {
        /**
         * A list of messages.
         *
         * You can either use `prompt` or `messages` but not both.
         */
        messages: Array<ModelMessage>;

        /**
         * A prompt. It can be either a text prompt or a list of messages.
         *
         * You can either use `prompt` or `messages` but not both.
         */
        prompt?: never;
      }
  ) & {
    /**
     * Abort signal.
     */
    abortSignal?: AbortSignal;

    /**
     * Timeout in milliseconds. Can be specified as a number or as an object with `totalMs`.
     */
    timeout?: TimeoutConfiguration<TOOLS>;

    /**
     * Callback that is called when the agent operation begins, before any LLM calls.
     */
    onStart?: GenerateTextOnStartCallback<TOOLS, RUNTIME_CONTEXT>;

    /**
     * Callback that is called when the agent operation begins, before any LLM calls.
     *
     * @deprecated Use `onStart` instead.
     */
    experimental_onStart?: GenerateTextOnStartCallback<TOOLS, RUNTIME_CONTEXT>;

    /**
     * Callback that is called when a step (LLM call) begins, before the provider is called.
     */
    onStepStart?: GenerateTextOnStepStartCallback<TOOLS, RUNTIME_CONTEXT>;

    /**
     * Callback that is called when a step (LLM call) begins, before the provider is called.
     *
     * @deprecated Use `onStepStart` instead.
     */
    experimental_onStepStart?: GenerateTextOnStepStartCallback<
      TOOLS,
      RUNTIME_CONTEXT
    >;

    /**
     * Callback that is called before each tool execution begins.
     */
    onToolExecutionStart?: OnToolExecutionStartCallback<TOOLS>;

    /**
     * Callback that is called before each tool execution begins.
     *
     * @deprecated Use `onToolExecutionStart` instead.
     */
    experimental_onToolCallStart?: OnToolExecutionStartCallback<TOOLS>;

    /**
     * Callback that is called after each tool execution completes.
     */
    onToolExecutionEnd?: OnToolExecutionEndCallback<TOOLS>;

    /**
     * Callback that is called after each tool execution completes.
     *
     * @deprecated Use `onToolExecutionEnd` instead.
     */
    experimental_onToolCallFinish?: OnToolExecutionEndCallback<TOOLS>;

    /**
     * Callback that is called when each step (LLM call) ends, including intermediate steps.
     */
    onStepEnd?: GenerateTextOnStepEndCallback<TOOLS, RUNTIME_CONTEXT>;

    /**
     * Callback that is called when each step (LLM call) ends, including intermediate steps.
     *
     * @deprecated Use `onStepEnd` instead.
     */
    onStepFinish?: GenerateTextOnStepFinishCallback<TOOLS, RUNTIME_CONTEXT>;

    /**
     * Callback that is called when all steps are finished and the response is complete.
     */
    onEnd?: GenerateTextOnEndCallback<TOOLS, RUNTIME_CONTEXT>;

    /**
     * Callback that is called when all steps are finished and the response is complete.
     *
     * @deprecated Use `onEnd` instead.
     */
    onFinish?: GenerateTextOnEndCallback<TOOLS, RUNTIME_CONTEXT>;

    /**
     * The sandbox environment that is passed through to tool execution.
     */
    experimental_sandbox?: SandboxSession;
  };

/**
 * Parameters for streaming an output from an agent.
 */
export type AgentStreamParameters<
  CALL_OPTIONS,
  TOOLS extends ToolSet,
  RUNTIME_CONTEXT extends Context = Context,
> = AgentCallParameters<CALL_OPTIONS, TOOLS, RUNTIME_CONTEXT> & {
  /**
   * Optional stream transformations.
   * They are applied in the order they are provided.
   * The stream transformations must maintain the stream structure for streamText to work correctly.
   */
  experimental_transform?: Arrayable<StreamTextTransform<TOOLS>>;
};

/**
 * An Agent receives a prompt (text or messages) and generates or streams an output
 * that consists of steps, tool calls, data parts, etc.
 *
 * You can implement your own Agent by implementing the `Agent` interface,
 * or use the `ToolLoopAgent` class.
 */
export interface Agent<
  CALL_OPTIONS = never,
  TOOLS extends ToolSet = {},
  RUNTIME_CONTEXT extends Context = Context,
  OUTPUT extends Output = never,
> {
  /**
   * The specification version of the agent interface. This will enable
   * us to evolve the agent interface and retain backwards compatibility.
   */
  readonly version: 'agent-v1';

  /**
   * The id of the agent.
   */
  readonly id: string | undefined;

  /**
   * The tools that the agent can use.
   */
  readonly tools: TOOLS;

  /**
   * Generates an output from the agent (non-streaming).
   */
  generate(
    options: AgentCallParameters<CALL_OPTIONS, TOOLS, RUNTIME_CONTEXT>,
  ): PromiseLike<GenerateTextResult<TOOLS, RUNTIME_CONTEXT, OUTPUT>>;

  /**
   * Streams an output from the agent (streaming).
   */
  stream(
    options: AgentStreamParameters<CALL_OPTIONS, TOOLS, RUNTIME_CONTEXT>,
  ): PromiseLike<StreamTextResult<TOOLS, RUNTIME_CONTEXT, OUTPUT>>;
}
