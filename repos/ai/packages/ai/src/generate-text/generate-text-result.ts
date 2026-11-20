import type { Context, ToolSet } from '@ai-sdk/provider-utils';
import type {
  CallWarning,
  FinishReason,
  LanguageModelResponseMetadata,
  ProviderMetadata,
} from '../types';
import type { Source } from '../types/language-model';
import type { LanguageModelUsage } from '../types/usage';
import type { ContentPart } from './content-part';
import type { GeneratedFile } from './generated-file';
import type { Output } from './output';
import type { InferCompleteOutput } from './output-utils';
import type { ReasoningFileOutput, ReasoningOutput } from './reasoning-output';
import type { ResponseMessage } from './response-message';
import type { StepResult } from './step-result';
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
 * The result of a `generateText` call.
 * It contains the generated text, the tool calls that were made during the generation, and the results of the tool calls.
 */
export interface GenerateTextResult<
  TOOLS extends ToolSet,
  RUNTIME_CONTEXT extends Context,
  OUTPUT extends Output,
> {
  /**
   * The content that was generated in all steps.
   */
  readonly content: Array<ContentPart<TOOLS>>;

  /**
   * The text that was generated in the final step.
   */
  readonly text: string;

  /**
   * The full reasoning that the model has generated in the last step.
   *
   * @deprecated Use `finalStep.reasoning` instead.
   */
  readonly reasoning: Array<ReasoningOutput | ReasoningFileOutput>;

  /**
   * The reasoning text that the model has generated in the last step. Can be undefined if the model
   * has only generated text.
   *
   * @deprecated Use `finalStep.reasoningText` instead.
   */
  readonly reasoningText: string | undefined;

  /**
   * The files that were generated in all steps.
   * Empty array if no files were generated.
   */
  readonly files: Array<GeneratedFile>;

  /**
   * Sources that have been used as references in all steps.
   */
  readonly sources: Array<Source>;

  /**
   * The tool calls that were made in all steps.
   */
  readonly toolCalls: Array<TypedToolCall<TOOLS>>;

  /**
   * The static tool calls that were made in all steps.
   */
  readonly staticToolCalls: Array<StaticToolCall<TOOLS>>;

  /**
   * The dynamic tool calls that were made in all steps.
   */
  readonly dynamicToolCalls: Array<DynamicToolCall>;

  /**
   * The results of the tool calls from all steps.
   */
  readonly toolResults: Array<TypedToolResult<TOOLS>>;

  /**
   * The static tool results that were made in all steps.
   */
  readonly staticToolResults: Array<StaticToolResult<TOOLS>>;

  /**
   * The dynamic tool results that were made in all steps.
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
   * The total token usage of all steps.
   * When there are multiple steps, the usage is the sum of all step usages.
   */
  readonly usage: LanguageModelUsage;

  /**
   * The total token usage of all steps.
   * When there are multiple steps, the usage is the sum of all step usages.
   *
   * @deprecated Use `usage` instead.
   */
  readonly totalUsage: LanguageModelUsage;

  /**
   * Warnings from the model provider (e.g. unsupported settings) in all steps.
   */
  readonly warnings: CallWarning[] | undefined;

  /**
   * Additional request information from the last step.
   *
   * @deprecated Use `finalStep.request` instead.
   */
  readonly request: StepResult<TOOLS, RUNTIME_CONTEXT>['request'];

  /**
   * Additional response information from the last step.
   *
   * @deprecated Use `finalStep.response` instead.
   */
  readonly response: LanguageModelResponseMetadata;

  /**
   * The accumulated response messages of all steps that were generated during the call.
   */
  readonly responseMessages: Array<ResponseMessage>;

  /**
   * Additional provider-specific metadata from the final step. They are passed
   * through from the provider to the AI SDK and enable provider-specific
   * results that can be fully encapsulated in the provider.
   *
   * @deprecated Use `finalStep.providerMetadata` instead.
   */
  readonly providerMetadata: ProviderMetadata | undefined;

  /**
   * Details for all steps.
   * You can use this to get information about intermediate steps,
   * such as the tool calls or the response headers.
   */
  readonly steps: Array<StepResult<TOOLS, RUNTIME_CONTEXT>>;

  /**
   * The final step. This is a shortcut for `steps.at(-1)`.
   */
  readonly finalStep: StepResult<TOOLS, RUNTIME_CONTEXT>;

  /**
   * The generated structured output. It uses the `output` specification.
   *
   */
  readonly output: InferCompleteOutput<OUTPUT>;
}
