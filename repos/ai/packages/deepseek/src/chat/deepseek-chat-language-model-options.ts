import { z } from 'zod/v4';

// https://api-docs.deepseek.com/quick_start/pricing
export type DeepSeekChatModelId =
  | 'deepseek-chat'
  | 'deepseek-reasoner'
  | (string & {});

export const deepseekLanguageModelChatOptions = z.object({
  /**
   * Type of thinking to use. Defaults to `enabled`.
   *
   * See https://api-docs.deepseek.com/guides/thinking_mode for the
   * `adaptive` option, which lets the model decide when to think.
   */
  thinking: z
    .object({
      type: z.enum(['adaptive', 'enabled', 'disabled']).optional(),
    })
    .optional(),

  /**
   * Controls the thinking strength for DeepSeek V4 reasoning models.
   *
   * DeepSeek's API accepts `low`, `medium`, `high`, `xhigh`, and `max`.
   * Per their docs, `low` and `medium` are mapped to `high`, and `xhigh`
   * is mapped to `max` server-side for compatibility with other providers.
   */
  reasoningEffort: z.enum(['low', 'medium', 'high', 'xhigh', 'max']).optional(),
});

export type DeepSeekLanguageModelChatOptions = z.infer<
  typeof deepseekLanguageModelChatOptions
>;
