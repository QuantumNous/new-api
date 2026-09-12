import { z } from 'zod/v4';

// https://docs.mistral.ai/getting-started/models/models_overview/
export type MistralChatModelId =
  | 'ministral-3b-latest'
  | 'ministral-8b-latest'
  | 'ministral-14b-latest'
  | 'mistral-large-latest'
  | 'mistral-medium-latest'
  | 'mistral-medium-3'
  | 'mistral-large-2512'
  | 'mistral-medium-2508'
  | 'mistral-medium-2505'
  | 'mistral-small-2506'
  | 'pixtral-large-latest'
  // reasoning config support models
  | 'mistral-medium-3.5'
  | 'mistral-small-latest'
  | 'mistral-small-2603'
  // reasoning models
  | 'magistral-medium-latest'
  | 'magistral-small-latest'
  | 'magistral-medium-2509'
  | 'magistral-small-2509'
  | (string & {});

export const mistralLanguageModelChatOptions = z.object({
  /**
   * Whether to inject a safety prompt before all conversations.
   *
   * Defaults to `false`.
   */
  safePrompt: z.boolean().optional(),

  documentImageLimit: z.number().optional(),
  documentPageLimit: z.number().optional(),

  /**
   * Whether to use structured outputs.
   *
   * @default true
   */
  structuredOutputs: z.boolean().optional(),

  /**
   * Whether to use strict JSON schema validation.
   *
   * @default false
   */
  strictJsonSchema: z.boolean().optional(),

  /**
   * Whether to enable parallel function calling during tool use.
   * When set to false, the model will use at most one tool per response.
   *
   * @default true
   */
  parallelToolCalls: z.boolean().optional(),

  /**
   * Controls the reasoning effort for models that support adjustable reasoning.
   *
   * - `'high'`: Enable reasoning
   * - `'none'`: Disable reasoning
   */
  reasoningEffort: z.enum(['high', 'none']).optional(),
});

export type MistralLanguageModelChatOptions = z.infer<
  typeof mistralLanguageModelChatOptions
>;
