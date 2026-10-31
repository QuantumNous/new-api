import type {
  ImageModelV4Usage,
  JSONObject,
  LanguageModelV4Usage,
} from '@ai-sdk/provider';

/**
 * Represents the number of tokens used in a prompt and completion.
 */
export type LanguageModelUsage = {
  /**
   * The total number of input (prompt) tokens used.
   */
  inputTokens: number | undefined;

  /**
   * Detailed information about the input tokens.
   */
  inputTokenDetails: {
    /**
     * The number of non-cached input (prompt) tokens used.
     */
    noCacheTokens: number | undefined;

    /**
     * The number of cached input (prompt) tokens read.
     */
    cacheReadTokens: number | undefined;

    /**
     * The number of cached input (prompt) tokens written.
     */
    cacheWriteTokens: number | undefined;
  };

  /**
   * The number of total output (completion) tokens used.
   */
  outputTokens: number | undefined;

  /**
   * Detailed information about the output tokens.
   */
  outputTokenDetails: {
    /**
     * The number of text tokens used.
     */
    textTokens: number | undefined;

    /**
     * The number of reasoning tokens used.
     */
    reasoningTokens: number | undefined;
  };

  /**
   * The total number of tokens used.
   */
  totalTokens: number | undefined;

  /**
   * Raw usage information from the provider.
   *
   * This is the usage information in the shape that the provider returns.
   * It can include additional information that is not part of the standard usage information.
   */
  raw?: JSONObject;
};

/**
 * Represents the number of tokens used in an embedding.
 */
// TODO replace with EmbeddingModelV4Usage once available in @ai-sdk/provider
export type EmbeddingModelUsage = {
  /**
   * The number of tokens used in the embedding.
   */
  tokens: number;
};

export function asLanguageModelUsage(
  usage: LanguageModelV4Usage,
): LanguageModelUsage {
  return {
    inputTokens: usage.inputTokens.total,
    inputTokenDetails: {
      noCacheTokens: usage.inputTokens.noCache,
      cacheReadTokens: usage.inputTokens.cacheRead,
      cacheWriteTokens: usage.inputTokens.cacheWrite,
    },
    outputTokens: usage.outputTokens.total,
    outputTokenDetails: {
      textTokens: usage.outputTokens.text,
      reasoningTokens: usage.outputTokens.reasoning,
    },
    totalTokens: addTokenCounts(
      usage.inputTokens.total,
      usage.outputTokens.total,
    ),
    raw: usage.raw,
  };
}

export function createNullLanguageModelUsage(): LanguageModelUsage {
  return {
    inputTokens: undefined,
    inputTokenDetails: {
      noCacheTokens: undefined,
      cacheReadTokens: undefined,
      cacheWriteTokens: undefined,
    },
    outputTokens: undefined,
    outputTokenDetails: {
      textTokens: undefined,
      reasoningTokens: undefined,
    },
    totalTokens: undefined,
    raw: undefined,
  };
}

export function addLanguageModelUsage(
  usage1: LanguageModelUsage,
  usage2: LanguageModelUsage,
): LanguageModelUsage {
  return {
    inputTokens: addTokenCounts(usage1.inputTokens, usage2.inputTokens),
    inputTokenDetails: {
      noCacheTokens: addTokenCounts(
        usage1.inputTokenDetails?.noCacheTokens,
        usage2.inputTokenDetails?.noCacheTokens,
      ),
      cacheReadTokens: addTokenCounts(
        usage1.inputTokenDetails?.cacheReadTokens,
        usage2.inputTokenDetails?.cacheReadTokens,
      ),
      cacheWriteTokens: addTokenCounts(
        usage1.inputTokenDetails?.cacheWriteTokens,
        usage2.inputTokenDetails?.cacheWriteTokens,
      ),
    },
    outputTokens: addTokenCounts(usage1.outputTokens, usage2.outputTokens),
    outputTokenDetails: {
      textTokens: addTokenCounts(
        usage1.outputTokenDetails?.textTokens,
        usage2.outputTokenDetails?.textTokens,
      ),
      reasoningTokens: addTokenCounts(
        usage1.outputTokenDetails?.reasoningTokens,
        usage2.outputTokenDetails?.reasoningTokens,
      ),
    },
    totalTokens: addTokenCounts(usage1.totalTokens, usage2.totalTokens),
  };
}

function addTokenCounts(
  tokenCount1: number | undefined,
  tokenCount2: number | undefined,
): number | undefined {
  return tokenCount1 == null && tokenCount2 == null
    ? undefined
    : (tokenCount1 ?? 0) + (tokenCount2 ?? 0);
}

/**
 * Usage information for an image model call.
 */
export type ImageModelUsage = ImageModelV4Usage;

export function addImageModelUsage(
  usage1: ImageModelUsage,
  usage2: ImageModelUsage,
): ImageModelUsage {
  return {
    inputTokens: addTokenCounts(usage1.inputTokens, usage2.inputTokens),
    outputTokens: addTokenCounts(usage1.outputTokens, usage2.outputTokens),
    totalTokens: addTokenCounts(usage1.totalTokens, usage2.totalTokens),
  };
}
