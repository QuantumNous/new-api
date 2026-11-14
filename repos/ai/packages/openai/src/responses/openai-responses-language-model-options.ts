import {
  lazySchema,
  zodSchema,
  type InferSchema,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

/**
 * `top_logprobs` request body argument can be set to an integer between
 * 0 and 20 specifying the number of most likely tokens to return at each
 * token position, each with an associated log probability.
 *
 * @see https://platform.openai.com/docs/api-reference/responses/create#responses_create-top_logprobs
 */
export const TOP_LOGPROBS_MAX = 20;

export const openaiResponsesReasoningModelIds = [
  'o1',
  'o1-2024-12-17',
  'o3',
  'o3-2025-04-16',
  'o3-mini',
  'o3-mini-2025-01-31',
  'o4-mini',
  'o4-mini-2025-04-16',
  'gpt-5',
  'gpt-5-2025-08-07',
  'gpt-5-codex',
  'gpt-5-mini',
  'gpt-5-mini-2025-08-07',
  'gpt-5-nano',
  'gpt-5-nano-2025-08-07',
  'gpt-5-pro',
  'gpt-5-pro-2025-10-06',
  'gpt-5.1',
  'gpt-5.1-chat-latest',
  'gpt-5.1-codex-mini',
  'gpt-5.1-codex',
  'gpt-5.1-codex-max',
  'gpt-5.2',
  'gpt-5.2-chat-latest',
  'gpt-5.2-pro',
  'gpt-5.2-codex',
  'gpt-5.3-chat-latest',
  'gpt-5.3-codex',
  'gpt-5.4',
  'gpt-5.4-2026-03-05',
  'gpt-5.4-mini',
  'gpt-5.4-mini-2026-03-17',
  'gpt-5.4-nano',
  'gpt-5.4-nano-2026-03-17',
  'gpt-5.4-pro',
  'gpt-5.4-pro-2026-03-05',
  'gpt-5.5',
  'gpt-5.5-2026-04-23',
  'gpt-5.6',
  'gpt-5.6-luna',
  'gpt-5.6-sol',
  'gpt-5.6-terra',
] as const;

export const openaiResponsesModelIds = [
  'gpt-4.1',
  'gpt-4.1-2025-04-14',
  'gpt-4.1-mini',
  'gpt-4.1-mini-2025-04-14',
  'gpt-4.1-nano',
  'gpt-4.1-nano-2025-04-14',
  'gpt-4o',
  'gpt-4o-2024-05-13',
  'gpt-4o-2024-08-06',
  'gpt-4o-2024-11-20',
  'gpt-4o-audio-preview',
  'gpt-4o-audio-preview-2024-12-17',
  'gpt-4o-search-preview',
  'gpt-4o-search-preview-2025-03-11',
  'gpt-4o-mini-search-preview',
  'gpt-4o-mini-search-preview-2025-03-11',
  'gpt-4o-mini',
  'gpt-4o-mini-2024-07-18',
  'gpt-3.5-turbo-0125',
  'gpt-3.5-turbo',
  'gpt-3.5-turbo-1106',
  'gpt-5-chat-latest',
  ...openaiResponsesReasoningModelIds,
] as const;

export type OpenAIResponsesModelId =
  | 'gpt-3.5-turbo-0125'
  | 'gpt-3.5-turbo-1106'
  | 'gpt-3.5-turbo'
  | 'gpt-4.1-2025-04-14'
  | 'gpt-4.1-mini-2025-04-14'
  | 'gpt-4.1-mini'
  | 'gpt-4.1-nano-2025-04-14'
  | 'gpt-4.1-nano'
  | 'gpt-4.1'
  | 'gpt-4o-2024-05-13'
  | 'gpt-4o-2024-08-06'
  | 'gpt-4o-2024-11-20'
  | 'gpt-4o-mini-2024-07-18'
  | 'gpt-4o-mini'
  | 'gpt-4o'
  | 'gpt-5.1'
  | 'gpt-5.1-2025-11-13'
  | 'gpt-5.1-chat-latest'
  | 'gpt-5.1-codex-mini'
  | 'gpt-5.1-codex'
  | 'gpt-5.1-codex-max'
  | 'gpt-5.2'
  | 'gpt-5.2-2025-12-11'
  | 'gpt-5.2-chat-latest'
  | 'gpt-5.2-pro'
  | 'gpt-5.2-pro-2025-12-11'
  | 'gpt-5.2-codex'
  | 'gpt-5.3-chat-latest'
  | 'gpt-5.3-codex'
  | 'gpt-5.4'
  | 'gpt-5.4-2026-03-05'
  | 'gpt-5.4-mini'
  | 'gpt-5.4-mini-2026-03-17'
  | 'gpt-5.4-nano'
  | 'gpt-5.4-nano-2026-03-17'
  | 'gpt-5.4-pro'
  | 'gpt-5.4-pro-2026-03-05'
  | 'gpt-5.5'
  | 'gpt-5.5-2026-04-23'
  | 'gpt-5.6'
  | 'gpt-5.6-luna'
  | 'gpt-5.6-sol'
  | 'gpt-5.6-terra'
  | 'gpt-5-2025-08-07'
  | 'gpt-5-chat-latest'
  | 'gpt-5-codex'
  | 'gpt-5-mini-2025-08-07'
  | 'gpt-5-mini'
  | 'gpt-5-nano-2025-08-07'
  | 'gpt-5-nano'
  | 'gpt-5-pro-2025-10-06'
  | 'gpt-5-pro'
  | 'gpt-5'
  | 'o1-2024-12-17'
  | 'o1'
  | 'o3-2025-04-16'
  | 'o3-mini-2025-01-31'
  | 'o3-mini'
  | 'o3'
  | 'o4-mini'
  | 'o4-mini-2025-04-16'
  | (string & {});

// TODO AI SDK 6: use optional here instead of nullish
export const openaiLanguageModelResponsesOptionsSchema = lazySchema(() =>
  zodSchema(
    z.object({
      /**
       * The ID of the OpenAI Conversation to continue.
       * You must create a conversation first via the OpenAI API.
       * Cannot be used in conjunction with `previousResponseId`.
       * Defaults to `undefined`.
       * @see https://platform.openai.com/docs/api-reference/conversations/create
       */
      conversation: z.string().nullish(),

      /**
       * The set of extra fields to include in the response (advanced, usually not needed).
       * Example values: 'reasoning.encrypted_content', 'file_search_call.results', 'web_search_call.results', 'message.output_text.logprobs'.
       */
      include: z
        .array(
          z.enum([
            'reasoning.encrypted_content', // handled internally by default, only needed for unknown reasoning models
            'file_search_call.results',
            'web_search_call.results',
            'message.output_text.logprobs',
          ]),
        )
        .nullish(),

      /**
       * Instructions for the model.
       * They can be used to change the system or developer message when continuing a conversation using the `previousResponseId` option.
       * Defaults to `undefined`.
       */
      instructions: z.string().nullish(),

      /**
       * Return the log probabilities of the tokens. Including logprobs will increase
       * the response size and can slow down response times. However, it can
       * be useful to better understand how the model is behaving.
       *
       * Setting to true will return the log probabilities of the tokens that
       * were generated.
       *
       * Setting to a number will return the log probabilities of the top n
       * tokens that were generated.
       *
       * @see https://platform.openai.com/docs/api-reference/responses/create
       * @see https://cookbook.openai.com/examples/using_logprobs
       */
      logprobs: z
        .union([z.boolean(), z.number().min(1).max(TOP_LOGPROBS_MAX)])
        .optional(),

      /**
       * The maximum number of total calls to built-in tools that can be processed in a response.
       * This maximum number applies across all built-in tool calls, not per individual tool.
       * Any further attempts to call a tool by the model will be ignored.
       */
      maxToolCalls: z.number().nullish(),

      /**
       * Additional metadata to store with the generation.
       */
      metadata: z.any().nullish(),

      /**
       * Whether to use parallel tool calls. Defaults to `true`.
       */
      parallelToolCalls: z.boolean().nullish(),

      /**
       * The ID of the previous response. You can use it to continue a conversation.
       * Defaults to `undefined`.
       */
      previousResponseId: z.string().nullish(),

      /**
       * Sets a cache key to tie this prompt to cached prefixes for better caching performance.
       */
      promptCacheKey: z.string().nullish(),

      /**
       * Prompt cache behavior for GPT-5.6 and later models.
       * `mode` controls whether OpenAI also places an implicit breakpoint.
       * `ttl` sets the minimum cache lifetime and currently only supports 30 minutes.
       */
      promptCacheOptions: z
        .object({
          mode: z.enum(['implicit', 'explicit']).optional(),
          ttl: z.literal('30m').optional(),
        })
        .optional(),

      /**
       * The retention policy for the prompt cache.
       * - 'in_memory': Default. Standard prompt caching behavior.
       * - '24h': Extended prompt caching that keeps cached prefixes active for up to 24 hours.
       *          Available for models before GPT-5.6 that support extended caching.
       *
       * @deprecated For GPT-5.6 and later models, use `promptCacheOptions.ttl`.
       *
       * @default 'in_memory'
       */
      promptCacheRetention: z.enum(['in_memory', '24h']).nullish(),

      /**
       * Reasoning effort for reasoning models. Defaults to `medium`. If you use
       * `providerOptions` to set the `reasoningEffort` option, this model setting will be ignored.
       * GPT-5.6 supports 'none' | 'low' | 'medium' | 'high' | 'xhigh' | 'max'.
       * Supported values vary by model.
       */
      reasoningEffort: z.string().nullish(),

      /**
       * Controls how much model work GPT-5.6 performs before returning a final answer.
       * `standard` is the default. `pro` increases quality, latency, and token usage.
       */
      reasoningMode: z.enum(['standard', 'pro']).optional(),

      /**
       * Controls which available reasoning items GPT-5.6 can use.
       * `auto` uses the model default, `current_turn` excludes reasoning from earlier
       * turns, and `all_turns` makes compatible earlier reasoning available.
       */
      reasoningContext: z
        .enum(['auto', 'current_turn', 'all_turns'])
        .optional(),

      /**
       * Controls reasoning summary output from the model.
       * Set to "auto" to automatically receive the richest level available,
       * or "detailed" for comprehensive summaries.
       */
      reasoningSummary: z.string().nullish(),

      /**
       * The identifier for safety monitoring and tracking.
       */
      safetyIdentifier: z.string().nullish(),

      /**
       * Service tier for the request.
       * Set to 'flex' for 50% cheaper processing at the cost of increased latency (available for o3, o4-mini, and gpt-5 models).
       * Set to 'priority' for faster processing with Enterprise access (available for gpt-4, gpt-5, gpt-5-mini, o3, o4-mini; gpt-5-nano is not supported).
       *
       * Defaults to 'auto'.
       */
      serviceTier: z.enum(['auto', 'flex', 'priority', 'default']).nullish(),

      /**
       * Whether to store the generation. Defaults to `true`.
       */
      store: z.boolean().nullish(),

      /**
       * Whether to pass through non-image file types as generic input files.
       *
       * By default, inline file inputs are restricted to images and PDFs.
       * Enable this when the target OpenAI Responses model supports additional
       * file media types, such as text/csv.
       */
      passThroughUnsupportedFiles: z.boolean().optional(),

      /**
       * Whether to use strict JSON schema validation.
       * Defaults to `true`.
       */
      strictJsonSchema: z.boolean().nullish(),

      /**
       * Controls the verbosity of the model's responses. Lower values ('low') will result
       * in more concise responses, while higher values ('high') will result in more verbose responses.
       * Valid values: 'low', 'medium', 'high'.
       */
      textVerbosity: z.enum(['low', 'medium', 'high']).nullish(),

      /**
       * Controls output truncation. 'auto' (default) performs truncation automatically;
       * 'disabled' turns truncation off.
       */
      truncation: z.enum(['auto', 'disabled']).nullish(),

      /**
       * A unique identifier representing your end-user, which can help OpenAI to
       * monitor and detect abuse.
       * Defaults to `undefined`.
       * @see https://platform.openai.com/docs/guides/safety-best-practices/end-user-ids
       */
      user: z.string().nullish(),

      /**
       * Override the system message mode for this model.
       * - 'system': Use the 'system' role for system messages (default for most models)
       * - 'developer': Use the 'developer' role for system messages (used by reasoning models)
       * - 'remove': Remove system messages entirely
       *
       * If not specified, the mode is automatically determined based on the model.
       */
      systemMessageMode: z.enum(['system', 'developer', 'remove']).optional(),

      /**
       * Force treating this model as a reasoning model.
       *
       * This is useful for "stealth" reasoning models (e.g. via a custom baseURL)
       * where the model ID is not recognized by the SDK's allowlist.
       *
       * When enabled, the SDK applies reasoning-model parameter compatibility rules
       * and defaults `systemMessageMode` to `developer` unless overridden.
       */
      forceReasoning: z.boolean().optional(),

      /**
       * Enable server-side context management (compaction).
       */
      contextManagement: z
        .array(
          z.object({
            type: z.literal('compaction'),
            compactThreshold: z.number(),
          }),
        )
        .nullish(),

      /**
       * Restrict the callable tools to a subset while keeping the full tools
       * list intact, so prompt caching is preserved across requests with
       * different allowlists.
       *
       * When set, this overrides the request-level `toolChoice` and emits
       * `tool_choice: { type: "allowed_tools", mode, tools }` on the wire.
       *
       * @see https://developers.openai.com/api/reference/resources/responses/methods/create#(resource)%20responses%20%3E%20(model)%20tool_choice_allowed%20%3E%20(schema)
       */
      allowedTools: z
        .object({
          toolNames: z.array(z.string()).min(1),
          mode: z.enum(['auto', 'required']).optional(),
        })
        .optional(),
    }),
  ),
);

export type OpenAILanguageModelResponsesOptions = InferSchema<
  typeof openaiLanguageModelResponsesOptionsSchema
>;
