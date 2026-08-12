import { z } from 'zod/v4';

// https://docs.x.ai/docs/models
export type XaiChatModelId =
  | 'grok-4.20-non-reasoning'
  | 'grok-4.20-reasoning'
  | 'grok-4.3'
  | 'grok-latest'
  | (string & {});

// search source schemas
const webSourceSchema = z.object({
  type: z.literal('web'),
  country: z.string().length(2).optional(),
  excludedWebsites: z.array(z.string()).max(5).optional(),
  allowedWebsites: z.array(z.string()).max(5).optional(),
  safeSearch: z.boolean().optional(),
});

const xSourceSchema = z.object({
  type: z.literal('x'),
  excludedXHandles: z.array(z.string()).optional(),
  includedXHandles: z.array(z.string()).optional(),
  postFavoriteCount: z.number().int().optional(),
  postViewCount: z.number().int().optional(),
  /**
   * @deprecated use `includedXHandles` instead
   */
  xHandles: z.array(z.string()).optional(),
});

const newsSourceSchema = z.object({
  type: z.literal('news'),
  country: z.string().length(2).optional(),
  excludedWebsites: z.array(z.string()).max(5).optional(),
  safeSearch: z.boolean().optional(),
});

const rssSourceSchema = z.object({
  type: z.literal('rss'),
  links: z.array(z.string().url()).max(1), // currently only supports one RSS link
});

const searchSourceSchema = z.discriminatedUnion('type', [
  webSourceSchema,
  xSourceSchema,
  newsSourceSchema,
  rssSourceSchema,
]);

// xai-specific provider options
export const xaiLanguageModelChatOptions = z.object({
  /**
   * Constrains how hard a reasoning model thinks before responding.
   *
   * - `none`: Disables reasoning entirely (supported by `grok-4.3` and newer
   *   reasoning models). When set, no thinking tokens are used.
   * - `low` (default): Uses some reasoning tokens, but still fast.
   * - `medium`: More thinking for less-latency-sensitive applications.
   * - `high`: Uses more reasoning tokens for deeper thinking.
   *
   * Note: Not every Grok model accepts every value. Refer to xAI's docs for
   * the values supported by your selected model.
   *
   * @see https://docs.x.ai/docs/guides/reasoning
   */
  reasoningEffort: z.enum(['none', 'low', 'medium', 'high']).optional(),
  logprobs: z.boolean().optional(),
  topLogprobs: z.number().int().min(0).max(8).optional(),

  /**
   * Whether to enable parallel function calling during tool use.
   * When true, the model can call multiple functions in parallel.
   * When false, the model will call functions sequentially.
   * Defaults to true.
   */
  parallel_function_calling: z.boolean().optional(),

  /**
   * @deprecated xAI has deprecated Live Search (`search_parameters`) in favor
   * of the Agent Tools API. Requests using this option now return a "Live
   * search is deprecated" error. Use the `web_search` / `x_search` tools
   * instead (e.g. `xai.tools.webSearch()`, `xai.tools.xSearch()`) with
   * `xai.responses(modelId)`.
   *
   * @see https://docs.x.ai/docs/guides/tools/overview
   */
  searchParameters: z
    .object({
      /**
       * search mode preference
       * - "off": disables search completely
       * - "auto": model decides whether to search (default)
       * - "on": always enables search
       */
      mode: z.enum(['off', 'auto', 'on']),

      /**
       * whether to return citations in the response
       * defaults to true
       */
      returnCitations: z.boolean().optional(),

      /**
       * start date for search data (ISO8601 format: YYYY-MM-DD)
       */
      fromDate: z.string().optional(),

      /**
       * end date for search data (ISO8601 format: YYYY-MM-DD)
       */
      toDate: z.string().optional(),

      /**
       * maximum number of search results to consider
       * defaults to 20
       */
      maxSearchResults: z.number().min(1).max(50).optional(),

      /**
       * data sources to search from.
       * defaults to [{ type: 'web' }, { type: 'x' }] if not specified.
       *
       * @example
       * sources: [{ type: 'web', country: 'US' }, { type: 'x' }]
       */
      sources: z.array(searchSourceSchema).optional(),
    })
    .optional(),
});

export type XaiLanguageModelChatOptions = z.infer<
  typeof xaiLanguageModelChatOptions
>;
