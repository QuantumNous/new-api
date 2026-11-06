import { z } from 'zod/v4';

// https://docs.cohere.com/docs/models
export type CohereChatModelId =
  | 'command-a-03-2025'
  | 'command-a-reasoning-08-2025'
  | 'command-a-vision-07-2025'
  | 'command-r7b-12-2024'
  | 'command-r-plus-04-2024'
  | 'command-r-plus'
  | 'command-r-08-2024'
  | 'command-r-03-2024'
  | 'command-r'
  | 'command'
  | 'command-nightly'
  | 'command-light'
  | 'command-light-nightly'
  | (string & {});

export const cohereLanguageModelChatOptions = z.object({
  /**
   * Configuration for reasoning features (optional)
   *
   * Can be set to an object with the two properties `type` and `tokenBudget`. `type` can be set to `'enabled'` or `'disabled'` (defaults to `'enabled'`).
   * `tokenBudget` is the maximum number of tokens the model can use for thinking, which must be set to a positive integer. The model will stop thinking if it reaches the thinking token budget and will proceed with the response
   *
   * @see https://docs.cohere.com/reference/chat#request.body.thinking
   */
  thinking: z
    .object({
      type: z.enum(['enabled', 'disabled']).optional(),
      tokenBudget: z.number().optional(),
    })
    .optional(),
});

export type CohereLanguageModelChatOptions = z.infer<
  typeof cohereLanguageModelChatOptions
>;

export const cohereImagePartProviderOptions = z.object({
  /**
   * Image fidelity level passed through as `image_url.detail` on the Cohere chat API.
   *
   * @see https://docs.cohere.com/docs/image-inputs
   */
  detail: z.enum(['auto', 'low', 'high']).optional(),
});

export type CohereImagePartProviderOptions = z.infer<
  typeof cohereImagePartProviderOptions
>;
