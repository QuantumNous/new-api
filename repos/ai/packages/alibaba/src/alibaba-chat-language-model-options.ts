import { z } from 'zod/v4';

// https://www.alibabacloud.com/help/en/model-studio/models
export type AlibabaChatModelId =
  // commercial edition - hybrid-thinking mode (disabled by default)
  | 'qwen3.7-max'
  | 'qwen3-max'
  | 'qwen3-max-preview'
  | 'qwen-plus'
  | 'qwen-plus-latest'
  | 'qwen-flash'
  | 'qwen-turbo'
  | 'qwen-turbo-latest'
  // open-source edition - hybrid-thinking mode (enabled by default)
  | 'qwen3-235b-a22b'
  | 'qwen3-32b'
  | 'qwen3-30b-a3b'
  | 'qwen3-14b'
  // thinking-only mode
  | 'qwen3-next-80b-a3b-thinking'
  | 'qwen3-235b-a22b-thinking-2507'
  | 'qwen3-30b-a3b-thinking-2507'
  | 'qwq-plus'
  | 'qwq-plus-latest'
  | 'qwq-32b'
  // code models
  | 'qwen-coder'
  | 'qwen3-coder-plus'
  | 'qwen3-coder-flash'
  | (string & {});

export const alibabaLanguageModelChatOptions = z.object({
  /**
   * Enable thinking/reasoning mode for supported models.
   * When enabled, the model generates reasoning content before the response.
   *
   * @default false
   */
  enableThinking: z.boolean().optional(),

  /**
   * Maximum number of reasoning tokens to generate.
   */
  thinkingBudget: z.number().positive().optional(),

  /**
   * Whether to enable parallel function calling during tool use.
   *
   * @default true
   */
  parallelToolCalls: z.boolean().optional(),
});

export type AlibabaLanguageModelChatOptions = z.infer<
  typeof alibabaLanguageModelChatOptions
>;
