import { z } from 'zod/v4';

// https://docs.fireworks.ai/docs/serverless-models#chat-models
// Below is just a subset of the available models.
export type FireworksChatModelId =
  | 'accounts/fireworks/models/deepseek-v3'
  | 'accounts/fireworks/models/llama-v3p3-70b-instruct'
  | 'accounts/fireworks/models/llama-v3p2-3b-instruct'
  | 'accounts/fireworks/models/llama-v3p1-405b-instruct'
  | 'accounts/fireworks/models/llama-v3p1-8b-instruct'
  | 'accounts/fireworks/models/mixtral-8x7b-instruct'
  | 'accounts/fireworks/models/mixtral-8x22b-instruct'
  | 'accounts/fireworks/models/mixtral-8x7b-instruct-hf'
  | 'accounts/fireworks/models/qwen2p5-coder-32b-instruct'
  | 'accounts/fireworks/models/qwen2p5-72b-instruct'
  | 'accounts/fireworks/models/qwen-qwq-32b-preview'
  | 'accounts/fireworks/models/qwen2-vl-72b-instruct'
  | 'accounts/fireworks/models/llama-v3p2-11b-vision-instruct'
  | 'accounts/fireworks/models/qwq-32b'
  | 'accounts/fireworks/models/yi-large'
  | 'accounts/fireworks/models/kimi-k2-instruct'
  | 'accounts/fireworks/models/kimi-k2-thinking'
  | 'accounts/fireworks/models/kimi-k2p6'
  | 'accounts/fireworks/models/minimax-m2'
  | (string & {});

export const fireworksLanguageModelOptions = z.object({
  /**
   * A stable key for routing requests with shared prompt prefixes to the same
   * prompt cache.
   */
  promptCacheKey: z.string().optional(),

  /**
   * Use Fireworks Priority serving path for higher reliability during peak traffic.
   */
  serviceTier: z.enum(['priority']).optional(),

  thinking: z
    .object({
      type: z.enum(['enabled', 'disabled']).optional(),
      budgetTokens: z.number().int().min(1024).optional(),
    })
    .optional(),

  reasoningHistory: z.enum(['disabled', 'interleaved', 'preserved']).optional(),
});

export type FireworksLanguageModelOptions = z.infer<
  typeof fireworksLanguageModelOptions
>;
