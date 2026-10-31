import type {
  LanguageModelV4CallOptions,
  LanguageModelV4GenerateResult,
  LanguageModelV4StreamResult,
} from '@ai-sdk/provider';
import { OpenAICompatibleChatLanguageModel } from '@ai-sdk/openai-compatible';
import {
  serializeModelOptions,
  WORKFLOW_SERIALIZE,
  WORKFLOW_DESERIALIZE,
  type FetchFunction,
} from '@ai-sdk/provider-utils';
type DeepInfraChatConfig = {
  provider: string;
  url: (options: { path: string; modelId?: string }) => string;
  headers?: () => Record<string, string | undefined>;
  fetch?: FetchFunction;
};

export class DeepInfraChatLanguageModel extends OpenAICompatibleChatLanguageModel {
  static [WORKFLOW_SERIALIZE](model: DeepInfraChatLanguageModel) {
    return serializeModelOptions({
      modelId: model.modelId,
      config: model.config,
    });
  }

  static [WORKFLOW_DESERIALIZE](options: {
    modelId: string;
    config: DeepInfraChatConfig;
  }) {
    return new DeepInfraChatLanguageModel(options.modelId, options.config);
  }

  constructor(modelId: string, config: DeepInfraChatConfig) {
    super(modelId, config);
  }

  /**
   * Fixes incorrect token usage for Gemini/Gemma models from DeepInfra.
   *
   * DeepInfra's API returns completion_tokens that don't include reasoning_tokens
   * for Gemini/Gemma models, which violates the OpenAI-compatible spec.
   * According to the spec, completion_tokens should include reasoning_tokens.
   *
   * Example of incorrect data from DeepInfra:
   * {
   *   "completion_tokens": 84,    // text-only tokens
   *   "completion_tokens_details": {
   *     "reasoning_tokens": 1081  // reasoning tokens not included above
   *   }
   * }
   *
   * This would result in negative text tokens: 84 - 1081 = -997
   *
   * The fix: If reasoning_tokens > completion_tokens, add reasoning_tokens
   * to completion_tokens: 84 + 1081 = 1165
   */
  private fixUsageForGeminiModels(usage: any): typeof usage {
    if (!usage || !usage.completion_tokens_details?.reasoning_tokens) {
      return usage;
    }

    const completionTokens = usage.completion_tokens ?? 0;
    const reasoningTokens = usage.completion_tokens_details.reasoning_tokens;

    // If reasoning tokens exceed completion tokens, the API data is incorrect
    // DeepInfra is returning only text tokens in completion_tokens, not including reasoning
    if (reasoningTokens > completionTokens) {
      const correctedCompletionTokens = completionTokens + reasoningTokens;

      return {
        ...usage,
        // Add reasoning_tokens to completion_tokens to get the correct total
        completion_tokens: correctedCompletionTokens,
        // Update total_tokens if present
        total_tokens:
          usage.total_tokens != null
            ? usage.total_tokens + reasoningTokens
            : undefined,
      };
    }

    return usage;
  }

  async doGenerate(
    options: LanguageModelV4CallOptions,
  ): Promise<LanguageModelV4GenerateResult> {
    const result = await super.doGenerate(options);

    // Fix usage if needed
    if (result.usage?.raw) {
      const fixedRawUsage = this.fixUsageForGeminiModels(result.usage.raw);
      if (fixedRawUsage !== result.usage.raw) {
        // Recalculate usage with fixed data
        const promptTokens = fixedRawUsage.prompt_tokens ?? 0;
        const completionTokens = fixedRawUsage.completion_tokens ?? 0;
        const cacheReadTokens =
          fixedRawUsage.prompt_tokens_details?.cached_tokens ?? 0;
        const reasoningTokens =
          fixedRawUsage.completion_tokens_details?.reasoning_tokens ?? 0;

        return {
          ...result,
          usage: {
            inputTokens: {
              total: promptTokens,
              noCache: promptTokens - cacheReadTokens,
              cacheRead: cacheReadTokens,
              cacheWrite: undefined,
            },
            outputTokens: {
              total: completionTokens,
              text: completionTokens - reasoningTokens,
              reasoning: reasoningTokens,
            },
            raw: fixedRawUsage,
          },
        };
      }
    }

    return result;
  }

  async doStream(
    options: LanguageModelV4CallOptions,
  ): Promise<LanguageModelV4StreamResult> {
    const result = await super.doStream(options);

    // Wrap the stream to fix usage in the final chunk
    const originalStream = result.stream;
    const fixUsage = this.fixUsageForGeminiModels.bind(this);

    const transformedStream = new ReadableStream({
      async start(controller) {
        const reader = originalStream.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // Fix usage in finish chunks
            if (value.type === 'finish' && value.usage?.raw) {
              const fixedRawUsage = fixUsage(value.usage.raw);
              if (fixedRawUsage !== value.usage.raw) {
                const promptTokens = fixedRawUsage.prompt_tokens ?? 0;
                const completionTokens = fixedRawUsage.completion_tokens ?? 0;
                const cacheReadTokens =
                  fixedRawUsage.prompt_tokens_details?.cached_tokens ?? 0;
                const reasoningTokens =
                  fixedRawUsage.completion_tokens_details?.reasoning_tokens ??
                  0;

                controller.enqueue({
                  ...value,
                  usage: {
                    inputTokens: {
                      total: promptTokens,
                      noCache: promptTokens - cacheReadTokens,
                      cacheRead: cacheReadTokens,
                      cacheWrite: undefined,
                    },
                    outputTokens: {
                      total: completionTokens,
                      text: completionTokens - reasoningTokens,
                      reasoning: reasoningTokens,
                    },
                    raw: fixedRawUsage,
                  },
                });
              } else {
                controller.enqueue(value);
              }
            } else {
              controller.enqueue(value);
            }
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return {
      ...result,
      stream: transformedStream,
    };
  }
}
