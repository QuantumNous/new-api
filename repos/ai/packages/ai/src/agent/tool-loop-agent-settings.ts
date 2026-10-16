import type {
  Arrayable,
  Context,
  FlexibleSchema,
  IdGenerator,
  InferToolSetContext,
  MaybePromiseLike,
  ProviderOptions,
  ToolSet,
} from '@ai-sdk/provider-utils';
import type { ActiveTools } from '../generate-text/active-tools';
import type {
  GenerateTextOnEndCallback,
  GenerateTextOnStartCallback,
  GenerateTextOnStepEndCallback,
  GenerateTextOnStepFinishCallback,
  GenerateTextOnStepStartCallback,
} from '../generate-text/generate-text-events';
import type { GenerateTextInclude } from '../generate-text/generate-text';
import type { Output } from '../generate-text/output';
import type { PrepareStepFunction } from '../generate-text/prepare-step';
import type { StopCondition } from '../generate-text/stop-condition';
import type { StreamTextInclude } from '../generate-text/stream-text';
import type { ToolApprovalConfiguration } from '../generate-text/tool-approval-configuration';
import type { ToolCallRepairFunction } from '../generate-text/tool-call-repair-function';
import type {
  OnToolExecutionEndCallback,
  OnToolExecutionStartCallback,
} from '../generate-text/tool-execution-events';
import type { ToolInputRefinement } from '../generate-text/tool-input-refinement';
import type { ToolOrder } from '../generate-text/tool-order';
import type { ToolsContextParameter } from '../generate-text/tools-context-parameter';
import type { LanguageModelCallOptions } from '../prompt/language-model-call-options';
import type { Instructions, Prompt } from '../prompt/prompt';
import type { RequestOptions } from '../prompt/request-options';
import type { TelemetryOptions } from '../telemetry/telemetry-options';
import type { LanguageModel, ToolChoice } from '../types/language-model';
import type { DownloadFunction } from '../util/download/download-function';
import type { AgentCallParameters } from './agent';

/**
 * Configuration options for an agent.
 */
export type ToolLoopAgentSettings<
  CALL_OPTIONS = never,
  TOOLS extends ToolSet = {},
  RUNTIME_CONTEXT extends Context = Context,
  OUTPUT extends Output = never,
> = LanguageModelCallOptions &
  Omit<RequestOptions<TOOLS>, 'abortSignal'> &
  ToolsContextParameter<TOOLS> & {
    /**
     * The id of the agent.
     */
    id?: string;

    /**
     * The instructions for the agent.
     *
     * It can be a string, or, if you need to pass additional provider options (e.g. for caching), a `SystemModelMessage`.
     */
    instructions?: Instructions;

    /**
     * Whether system messages are allowed in the `prompt` or `messages` fields.
     *
     * When disabled, system messages must be provided through the `instructions`
     * option.
     *
     * @default false
     */
    allowSystemInMessages?: boolean;

    /**
     * The language model to use.
     */
    model: LanguageModel;

    /**
     * The tool choice strategy. Default: 'auto'.
     */
    toolChoice?: ToolChoice<NoInfer<TOOLS>>;

    /**
     * Condition for stopping the generation when there are tool results in the last step.
     * When the condition is an array, any of the conditions can be met to stop the generation.
     *
     * @default isStepCount(20)
     */
    stopWhen?: Arrayable<StopCondition<NoInfer<TOOLS>, RUNTIME_CONTEXT>>;

    /**
     * Optional telemetry configuration.
     */
    telemetry?: TelemetryOptions<RUNTIME_CONTEXT, NoInfer<TOOLS>>;

    /**
     * Optional telemetry configuration.
     *
     * @deprecated Use `telemetry` instead. This alias will be removed in a future major release.
     */
    experimental_telemetry?: TelemetryOptions<RUNTIME_CONTEXT, NoInfer<TOOLS>>;

    /**
     * Limits the tools that are available for the model to call without
     * changing the tool call and result types in the result.
     */
    activeTools?: ActiveTools<NoInfer<TOOLS>>;

    /**
     * Controls the order in which tools are sent to the provider.
     *
     * The list can be partial. Tools not listed in `toolOrder` are sent after
     * the listed tools, sorted alphabetically. This can improve provider-side
     * caching by keeping tool definitions in a stable order.
     */
    toolOrder?: ToolOrder<NoInfer<TOOLS>>;

    /**
     * Optional specification for generating structured outputs.
     */
    output?: OUTPUT;

    /**
     * Runtime context. Treat runtime context as immutable.
     * If you need to mutate runtime context, update it in `prepareStep`.
     */
    runtimeContext?: RUNTIME_CONTEXT;

    /**
     * Optional tool approval configuration.
     *
     * This configuration takes precedence over tool-defined approval settings.
     */
    toolApproval?: ToolApprovalConfiguration<NoInfer<TOOLS>, RUNTIME_CONTEXT>;

    /**
     * Optional function that you can use to provide different settings for a step.
     */
    prepareStep?: PrepareStepFunction<NoInfer<TOOLS>, RUNTIME_CONTEXT>;

    /**
     * A function that attempts to repair a tool call that failed to parse.
     */
    repairToolCall?: ToolCallRepairFunction<NoInfer<TOOLS>>;

    /**
     * A function that attempts to repair a tool call that failed to parse.
     *
     * @deprecated Use `repairToolCall` instead.
     */
    experimental_repairToolCall?: ToolCallRepairFunction<NoInfer<TOOLS>>;

    /**
     * Optional mapping of tool names to functions that refine parsed tool inputs.
     *
     * The refined input must have the same type shape as the tool input. Refined
     * inputs are used for tool execution, outputs, callbacks, and telemetry.
     */
    experimental_refineToolInput?: ToolInputRefinement<NoInfer<TOOLS>>;

    /**
     * Callback that is called when the agent operation begins, before any LLM calls.
     */
    onStart?: GenerateTextOnStartCallback<
      NoInfer<TOOLS>,
      RUNTIME_CONTEXT,
      NoInfer<OUTPUT>
    >;

    /**
     * Callback that is called when the agent operation begins, before any LLM calls.
     *
     * @deprecated Use `onStart` instead.
     */
    experimental_onStart?: GenerateTextOnStartCallback<
      NoInfer<TOOLS>,
      RUNTIME_CONTEXT,
      NoInfer<OUTPUT>
    >;

    /**
     * Callback that is called when a step (LLM call) begins, before the provider is called.
     */
    onStepStart?: GenerateTextOnStepStartCallback<
      NoInfer<TOOLS>,
      NoInfer<RUNTIME_CONTEXT>,
      NoInfer<OUTPUT>
    >;

    /**
     * Callback that is called when a step (LLM call) begins, before the provider is called.
     *
     * @deprecated Use `onStepStart` instead.
     */
    experimental_onStepStart?: GenerateTextOnStepStartCallback<
      NoInfer<TOOLS>,
      NoInfer<RUNTIME_CONTEXT>,
      NoInfer<OUTPUT>
    >;

    /**
     * Callback that is called before each tool execution begins.
     */
    onToolExecutionStart?: OnToolExecutionStartCallback<NoInfer<TOOLS>>;

    /**
     * Callback that is called after each tool execution completes.
     */
    onToolExecutionEnd?: OnToolExecutionEndCallback<NoInfer<TOOLS>>;

    /**
     * Callback that is called when each step (LLM call) ends, including intermediate steps.
     */
    onStepEnd?: GenerateTextOnStepEndCallback<
      NoInfer<TOOLS>,
      NoInfer<RUNTIME_CONTEXT>
    >;

    /**
     * Callback that is called when each step (LLM call) ends, including intermediate steps.
     *
     * @deprecated Use `onStepEnd` instead.
     */
    onStepFinish?: GenerateTextOnStepFinishCallback<
      NoInfer<TOOLS>,
      NoInfer<RUNTIME_CONTEXT>
    >;

    /**
     * Callback that is called when all steps are finished and the response is complete.
     */
    onEnd?: GenerateTextOnEndCallback<NoInfer<TOOLS>, NoInfer<RUNTIME_CONTEXT>>;

    /**
     * Callback that is called when all steps are finished and the response is complete.
     *
     * @deprecated Use `onEnd` instead.
     */
    onFinish?: GenerateTextOnEndCallback<
      NoInfer<TOOLS>,
      NoInfer<RUNTIME_CONTEXT>
    >;

    /**
     * Additional provider-specific options. They are passed through
     * to the provider from the AI SDK and enable provider-specific
     * functionality that can be fully encapsulated in the provider.
     */
    providerOptions?: ProviderOptions;

    /**
     * Custom download function to use for URLs.
     *
     * By default, files are downloaded if the model does not support the URL for the given media type.
     */
    experimental_download?: DownloadFunction | undefined;

    /**
     * Settings for controlling what data is included in step results.
     * Disabling inclusion can help reduce memory usage when processing
     * large payloads like images.
     *
     * By default, request and response bodies are included, and request
     * messages are excluded.
     */
    include?: GenerateTextInclude & StreamTextInclude;

    /**
     * Internal. For test use only. May change without notice.
     */
    _internal?: {
      generateId?: IdGenerator;
      generateCallId?: IdGenerator;
    };

    /**
     * The schema for the call options.
     */
    callOptionsSchema?: FlexibleSchema<CALL_OPTIONS>;

    /**
     * Prepare the parameters for the generateText or streamText call.
     *
     * You can use this to have templates based on call options.
     *
     * The design requires you to pass call parameters as follows to
     * allow for the removal of parameters from the original settings
     * by setting them to `undefined`:
     *
     * ```
     *   prepareCall: ({ options, ...rest }) => ({
     *     ...rest,
     *   }),
     * ```
     */
    prepareCall?: (
      options: Omit<
        AgentCallParameters<
          CALL_OPTIONS,
          NoInfer<TOOLS>,
          NoInfer<RUNTIME_CONTEXT>
        >,
        'onStepEnd' | 'onStepFinish'
      > &
        Pick<
          ToolLoopAgentSettings<
            CALL_OPTIONS,
            TOOLS,
            RUNTIME_CONTEXT,
            NoInfer<OUTPUT>
          >,
          | 'model'
          | 'tools'
          | 'maxOutputTokens'
          | 'temperature'
          | 'topP'
          | 'topK'
          | 'presencePenalty'
          | 'frequencyPenalty'
          | 'stopSequences'
          | 'seed'
          | 'headers'
          | 'instructions'
          | 'allowSystemInMessages'
          | 'stopWhen'
          | 'telemetry'
          | 'experimental_telemetry'
          | 'activeTools'
          | 'toolOrder'
          | 'toolApproval'
          | 'providerOptions'
          | 'experimental_download'
          | 'experimental_refineToolInput'
          | 'include'
          | 'runtimeContext'
          | '_internal'
        > & { toolsContext: InferToolSetContext<TOOLS> },
    ) => MaybePromiseLike<
      Pick<
        ToolLoopAgentSettings<
          CALL_OPTIONS,
          TOOLS,
          RUNTIME_CONTEXT,
          NoInfer<OUTPUT>
        >,
        | 'model'
        | 'tools'
        | 'maxOutputTokens'
        | 'temperature'
        | 'topP'
        | 'topK'
        | 'presencePenalty'
        | 'frequencyPenalty'
        | 'stopSequences'
        | 'seed'
        | 'headers'
        | 'instructions'
        | 'allowSystemInMessages'
        | 'stopWhen'
        | 'telemetry'
        | 'experimental_telemetry'
        | 'activeTools'
        | 'toolOrder'
        | 'toolApproval'
        | 'providerOptions'
        | 'experimental_download'
        | 'experimental_refineToolInput'
        | 'include'
        | 'runtimeContext'
        | '_internal'
      > &
        Omit<Prompt, 'system'> & {
          toolsContext: InferToolSetContext<TOOLS>;
        }
    >;
  };
