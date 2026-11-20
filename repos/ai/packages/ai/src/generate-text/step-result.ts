import type {
  Context,
  InferToolSetContext,
  ReasoningFilePart,
  ReasoningPart,
  ToolSet,
} from '@ai-sdk/provider-utils';
import type {
  CallWarning,
  FinishReason,
  LanguageModelRequestMetadata,
  LanguageModelResponseMetadata,
  ProviderMetadata,
} from '../types';
import type { Source } from '../types/language-model';
import type { LanguageModelUsage } from '../types/usage';
import type { ContentPart } from './content-part';
import type { GeneratedFile } from './generated-file';
import { asReasoningText } from './reasoning';
import {
  convertFromReasoningOutputs,
  type ReasoningFileOutput,
  type ReasoningOutput,
} from './reasoning-output';
import type {
  DynamicToolCall,
  StaticToolCall,
  TypedToolCall,
} from './tool-call';
import type {
  DynamicToolResult,
  StaticToolResult,
  TypedToolResult,
} from './tool-result';

/**
 * Timing statistics for the gaps between generated output chunks.
 */
export type OutputChunkTimingStats = {
  /** Shortest observed time between output chunks in milliseconds. */
  readonly min: number;

  /** 10th percentile time between output chunks in milliseconds. */
  readonly p10: number;

  /** Median time between output chunks in milliseconds. */
  readonly median: number;

  /** Average time between output chunks in milliseconds. */
  readonly avg: number;

  /** 90th percentile time between output chunks in milliseconds. */
  readonly p90: number;

  /** Longest observed time between output chunks in milliseconds. */
  readonly max: number;
};

/**
 * Performance metrics for a single step in the generation process.
 */
export type StepResultPerformance = {
  /**
   * Effective number of output tokens per second over the full language model
   * response.
   *
   * Calculated as `outputTokens / requestSeconds`.
   */
  readonly effectiveOutputTokensPerSecond: number;

  /**
   * Number of output tokens per second after the first generated output chunk
   * was received.
   *
   * Only available for streaming steps.
   *
   * Calculated as `outputTokens / outputStreamSeconds`.
   */
  readonly outputTokensPerSecond: number | undefined;

  /**
   * Number of input tokens processed per second before the first generated
   * output chunk was received.
   *
   * Only available for streaming steps.
   *
   * Calculated as `inputTokens / ttftSeconds`.
   */
  readonly inputTokensPerSecond: number | undefined;

  /**
   * Effective number of input and output tokens per second over the full
   * language model response.
   *
   * Calculated as `(inputTokens + outputTokens) / requestSeconds`.
   */
  readonly effectiveTotalTokensPerSecond: number;

  /**
   * Total time spent on the step in milliseconds.
   */
  readonly stepTimeMs: number;

  /**
   * Time spent waiting for the language model response in milliseconds.
   */
  readonly responseTimeMs: number;

  /**
   * Time spent executing each client-side tool call in milliseconds, keyed by
   * tool call ID.
   */
  readonly toolExecutionMs: Readonly<Record<string, number>>;

  /**
   * Time until the first generated output chunk was received in milliseconds.
   *
   * This includes text deltas, reasoning deltas, generated files, reasoning
   * files, tool input deltas, and tool calls.
   *
   * Only available for streaming steps.
   */
  readonly timeToFirstOutputMs: number | undefined;

  /**
   * Timing statistics for the gaps between generated output chunks in
   * milliseconds.
   *
   * Only available for streaming steps with at least two generated output
   * chunks.
   */
  readonly timeBetweenOutputChunksMs?: OutputChunkTimingStats;
};

/**
 * The result of a single step in the generation process.
 */
export type StepResult<
  TOOLS extends ToolSet,
  RUNTIME_CONTEXT extends Context = Context,
> = {
  /**
   * Unique identifier for the generation call this step belongs to.
   */
  readonly callId: string;

  /**
   * Zero-based index of this step.
   */
  readonly stepNumber: number;

  /**
   * Information about the model that produced this step.
   */
  readonly model: {
    /** The provider of the model. */
    readonly provider: string;

    /** The ID of the model. */
    readonly modelId: string;
  };

  /**
   * Tool context.
   */
  readonly toolsContext: InferToolSetContext<TOOLS>;

  /**
   * The runtime context that was used as input for the step.
   */
  readonly runtimeContext: RUNTIME_CONTEXT;

  /**
   * The content that was generated in the last step.
   */
  readonly content: Array<ContentPart<TOOLS>>;

  /**
   * The generated text. Can be an empty string if the model has not generated any text.
   */
  readonly text: string;

  /**
   * The reasoning that was generated during the generation.
   */
  readonly reasoning: Array<ReasoningPart | ReasoningFilePart>;

  /**
   * The reasoning text that was generated during the generation.
   *
   * It is a concatenation of all reasoning parts (but excluding reasoning file parts).
   * Can be undefined if the model has only generated text.
   */
  readonly reasoningText: string | undefined;

  /**
   * The files that were generated during the generation.
   */
  readonly files: Array<GeneratedFile>;

  /**
   * The sources that were used to generate the text.
   */
  readonly sources: Array<Source>;

  /**
   * The tool calls that were made during the generation.
   */
  readonly toolCalls: Array<TypedToolCall<TOOLS>>;

  /**
   * The static tool calls that were made in the last step.
   */
  readonly staticToolCalls: Array<StaticToolCall<TOOLS>>;

  /**
   * The dynamic tool calls that were made in the last step.
   */
  readonly dynamicToolCalls: Array<DynamicToolCall>;

  /**
   * The results of the tool calls.
   */
  readonly toolResults: Array<TypedToolResult<TOOLS>>;

  /**
   * The static tool results that were made in the last step.
   */
  readonly staticToolResults: Array<StaticToolResult<TOOLS>>;

  /**
   * The dynamic tool results that were made in the last step.
   */
  readonly dynamicToolResults: Array<DynamicToolResult>;

  /**
   * The unified reason why the generation finished.
   */
  readonly finishReason: FinishReason;

  /**
   * The raw reason why the generation finished (from the provider).
   */
  readonly rawFinishReason: string | undefined;

  /**
   * The token usage of the generated text.
   */
  readonly usage: LanguageModelUsage;

  /**
   * Performance metrics for the step.
   */
  readonly performance: StepResultPerformance;

  /**
   * Warnings from the model provider (e.g. unsupported settings).
   */
  readonly warnings: CallWarning[] | undefined;

  /**
   * Additional request information.
   */
  readonly request: LanguageModelRequestMetadata;

  /**
   * Additional response information.
   */
  readonly response: LanguageModelResponseMetadata;

  /**
   * Additional provider-specific metadata. They are passed through
   * from the provider to the AI SDK and enable provider-specific
   * results that can be fully encapsulated in the provider.
   */
  readonly providerMetadata: ProviderMetadata | undefined;
};

export class DefaultStepResult<
  TOOLS extends ToolSet,
  RUNTIME_CONTEXT extends Context = Context,
> implements StepResult<TOOLS, RUNTIME_CONTEXT> {
  readonly callId: StepResult<TOOLS, RUNTIME_CONTEXT>['callId'];
  readonly stepNumber: StepResult<TOOLS, RUNTIME_CONTEXT>['stepNumber'];
  readonly model: StepResult<TOOLS, RUNTIME_CONTEXT>['model'];
  readonly toolsContext: StepResult<TOOLS, RUNTIME_CONTEXT>['toolsContext'];
  readonly runtimeContext: StepResult<TOOLS, RUNTIME_CONTEXT>['runtimeContext'];
  readonly content: StepResult<TOOLS, RUNTIME_CONTEXT>['content'];
  readonly finishReason: StepResult<TOOLS, RUNTIME_CONTEXT>['finishReason'];
  readonly rawFinishReason: StepResult<
    TOOLS,
    RUNTIME_CONTEXT
  >['rawFinishReason'];
  readonly usage: StepResult<TOOLS, RUNTIME_CONTEXT>['usage'];
  readonly performance: StepResult<TOOLS, RUNTIME_CONTEXT>['performance'];
  readonly warnings: StepResult<TOOLS, RUNTIME_CONTEXT>['warnings'];
  readonly request: StepResult<TOOLS, RUNTIME_CONTEXT>['request'];
  readonly response: StepResult<TOOLS, RUNTIME_CONTEXT>['response'];
  readonly providerMetadata: StepResult<
    TOOLS,
    RUNTIME_CONTEXT
  >['providerMetadata'];

  constructor({
    callId,
    stepNumber,
    provider,
    modelId,
    runtimeContext,
    toolsContext,
    content,
    finishReason,
    rawFinishReason,
    usage,
    performance,
    warnings,
    request,
    response,
    providerMetadata,
  }: {
    callId: StepResult<TOOLS, RUNTIME_CONTEXT>['callId'];
    stepNumber: StepResult<TOOLS, RUNTIME_CONTEXT>['stepNumber'];
    provider: StepResult<TOOLS, RUNTIME_CONTEXT>['model']['provider'];
    modelId: StepResult<TOOLS, RUNTIME_CONTEXT>['model']['modelId'];
    runtimeContext: StepResult<TOOLS, RUNTIME_CONTEXT>['runtimeContext'];
    toolsContext: StepResult<TOOLS, RUNTIME_CONTEXT>['toolsContext'];
    content: StepResult<TOOLS, RUNTIME_CONTEXT>['content'];
    finishReason: StepResult<TOOLS, RUNTIME_CONTEXT>['finishReason'];
    rawFinishReason: StepResult<TOOLS, RUNTIME_CONTEXT>['rawFinishReason'];
    usage: StepResult<TOOLS, RUNTIME_CONTEXT>['usage'];
    performance: StepResult<TOOLS, RUNTIME_CONTEXT>['performance'];
    warnings: StepResult<TOOLS, RUNTIME_CONTEXT>['warnings'];
    request: StepResult<TOOLS, RUNTIME_CONTEXT>['request'];
    response: StepResult<TOOLS, RUNTIME_CONTEXT>['response'];
    providerMetadata: StepResult<TOOLS, RUNTIME_CONTEXT>['providerMetadata'];
  }) {
    this.callId = callId;
    this.stepNumber = stepNumber;
    this.model = { provider, modelId };
    this.runtimeContext = runtimeContext;
    this.toolsContext = toolsContext;
    this.content = content;
    this.finishReason = finishReason;
    this.rawFinishReason = rawFinishReason;
    this.usage = usage;
    this.performance = performance;
    this.warnings = warnings;
    this.request = request;
    this.response = response;
    this.providerMetadata = providerMetadata;
  }

  get text() {
    return this.content
      .filter(part => part.type === 'text')
      .map(part => part.text)
      .join('');
  }

  get reasoning(): Array<ReasoningPart | ReasoningFilePart> {
    return convertFromReasoningOutputs(
      this.content.filter(
        (part): part is ReasoningOutput | ReasoningFileOutput =>
          part.type === 'reasoning' || part.type === 'reasoning-file',
      ),
    );
  }

  get reasoningText() {
    return asReasoningText(this.reasoning);
  }

  get files() {
    return this.content
      .filter(part => part.type === 'file')
      .map(part => part.file);
  }

  get sources() {
    return this.content.filter(part => part.type === 'source');
  }

  get toolCalls() {
    return this.content.filter(part => part.type === 'tool-call');
  }

  get staticToolCalls() {
    return this.toolCalls.filter(
      (toolCall): toolCall is StaticToolCall<TOOLS> =>
        toolCall.dynamic !== true,
    );
  }

  get dynamicToolCalls() {
    return this.toolCalls.filter(
      (toolCall): toolCall is DynamicToolCall => toolCall.dynamic === true,
    );
  }

  get toolResults() {
    return this.content.filter(part => part.type === 'tool-result');
  }

  get staticToolResults() {
    return this.toolResults.filter(
      (toolResult): toolResult is StaticToolResult<TOOLS> =>
        toolResult.dynamic !== true,
    );
  }

  get dynamicToolResults() {
    return this.toolResults.filter(
      (toolResult): toolResult is DynamicToolResult =>
        toolResult.dynamic === true,
    );
  }
}
