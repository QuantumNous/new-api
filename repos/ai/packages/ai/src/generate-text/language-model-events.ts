import type { ToolSet } from '@ai-sdk/provider-utils';
import type { Callback } from '../util/callback';
import type { FinishReason } from '../types/language-model';
import type { LanguageModelUsage } from '../types/usage';
import type { ContentPart } from './content-part';
import type { StandardizedPrompt } from '../prompt/standardize-prompt';
import type { LanguageModelCallOptions } from '../prompt';
import type { OutputChunkTimingStats } from './step-result';

/**
 * Common model information used across callback events.
 */
export type ModelInfo = {
  /** The provider identifier (e.g., 'openai', 'anthropic'). */
  readonly provider: string;
  /** The specific model identifier (e.g., 'gpt-4o'). */
  readonly modelId: string;
};

/**
 * Event passed to the `onLanguageModelCallStart` callback.
 *
 * Called immediately before the provider model call begins.
 * Unlike `onStepStart`, this only represents model invocation work.
 */
export type LanguageModelCallStartEvent = ModelInfo & {
  /** Unique identifier for this generation call, used to correlate events. */
  readonly callId: string;

  /** Prepared tool definitions for the model call, if any. */
  readonly tools: ReadonlyArray<Record<string, unknown>> | undefined;
} & StandardizedPrompt &
  LanguageModelCallOptions;

/**
 * Event passed to the `onLanguageModelCallEnd` callback.
 *
 * Called after the model response has been normalized and parsed, but before
 * any client-side tool execution begins.
 */
export type LanguageModelCallEndEvent<TOOLS extends ToolSet = ToolSet> =
  ModelInfo & {
    /** Unique identifier for this generation call, used to correlate events. */
    readonly callId: string;

    /** The unified reason why the model call finished. */
    readonly finishReason: FinishReason;

    /** The token usage reported by the model call. */
    readonly usage: LanguageModelUsage;

    /** The content parts produced by the model call. */
    readonly content: ReadonlyArray<ContentPart<TOOLS>>;

    /** The provider-returned response id for this model call. */
    readonly responseId: string;

    /** Performance metrics for the model call. */
    readonly performance: {
      /** Time spent waiting for the language model response in milliseconds. */
      readonly responseTimeMs: number;

      /**
       * Effective number of output tokens per second over the full language
       * model response.
       */
      readonly effectiveOutputTokensPerSecond: number;

      /**
       * Number of output tokens per second after the first generated output
       * chunk was received.
       *
       * Only available for streaming calls.
       */
      readonly outputTokensPerSecond: number | undefined;

      /**
       * Number of input tokens processed per second before the first generated
       * output chunk was received.
       *
       * Only available for streaming calls.
       */
      readonly inputTokensPerSecond: number | undefined;

      /**
       * Effective number of input and output tokens per second over the full
       * language model response.
       */
      readonly effectiveTotalTokensPerSecond: number;

      /**
       * Time until the first generated output chunk was received in
       * milliseconds.
       */
      readonly timeToFirstOutputMs: number | undefined;

      /**
       * Timing statistics for the gaps between generated output chunks in
       * milliseconds.
       *
       * Only available for streaming calls with at least two output chunks.
       */
      readonly timeBetweenOutputChunksMs?: OutputChunkTimingStats;
    };
  };

/**
 * Callback that is set using the `onLanguageModelCallStart` option.
 *
 * Called immediately before the provider model call begins.
 * Unlike step-start callbacks, this is scoped to model work only and
 * excludes any later client-side tool execution.
 *
 * @param event - The event object containing model-call-specific inputs.
 */
export type OnLanguageModelCallStartCallback =
  Callback<LanguageModelCallStartEvent>;

/**
 * Callback that is set using the `onLanguageModelCallEnd` option.
 *
 * Called after the model response has been normalized and parsed, but before
 * any client-side tool execution begins.
 *
 * @param event - The event object containing model-call-specific outputs.
 */
export type OnLanguageModelCallEndCallback<TOOLS extends ToolSet = ToolSet> =
  Callback<LanguageModelCallEndEvent<TOOLS>>;
