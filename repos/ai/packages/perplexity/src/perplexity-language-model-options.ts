import { z } from 'zod/v4';

export const perplexityLanguageModelOptions = z.looseObject({
  /**
   * Filters search results to those published within the specified time window.
   * Cannot be combined with other date filters.
   */
  search_recency_filter: z
    .enum(['hour', 'day', 'week', 'month', 'year'])
    .optional(),

  /**
   * Restrict web search results to specific domains or URLs.
   * Prefix a domain with "-" to exclude it.
   */
  search_domain_filter: z.array(z.string()).optional(),

  /**
   * Filter search results by language using ISO 639-1 codes.
   */
  search_language_filter: z.array(z.string()).optional(),

  /**
   * Return search results published after this date.
   */
  search_after_date_filter: z.string().optional(),

  /**
   * Return search results published before this date.
   */
  search_before_date_filter: z.string().optional(),

  /**
   * Return search results last updated after this date.
   */
  last_updated_after_filter: z.string().optional(),

  /**
   * Return search results last updated before this date.
   */
  last_updated_before_filter: z.string().optional(),

  /**
   * Source of search results.
   */
  search_mode: z.enum(['web', 'academic', 'sec']).optional(),

  /**
   * If true, the model decides whether web search is needed.
   */
  enable_search_classifier: z.boolean().optional(),

  /**
   * If true, disables web search.
   */
  disable_search: z.boolean().optional(),

  /**
   * If true, a list of related questions is included in the response.
   */
  return_related_questions: z.boolean().optional(),

  /**
   * If true, image search results are included in the response.
   */
  return_images: z.boolean().optional(),

  /**
   * Restrict image results to specific domains.
   * Prefix a domain with "-" to exclude it.
   */
  image_domain_filter: z.array(z.string()).optional(),

  /**
   * Restrict image results to specific file formats.
   */
  image_format_filter: z.array(z.string()).optional(),

  /**
   * Additional media response configuration.
   */
  media_response: z
    .looseObject({
      overrides: z
        .looseObject({
          /**
           * If true, video results are included in the response.
           */
          return_videos: z.boolean().optional(),
        })
        .optional(),
    })
    .optional(),

  /**
   * Controls the format of streaming events.
   */
  stream_mode: z.enum(['full', 'concise']).optional(),

  /**
   * Controls how much effort the model spends on reasoning.
   */
  reasoning_effort: z.enum(['minimal', 'low', 'medium', 'high']).optional(),

  /**
   * Preferred response language as an ISO 639-1 language code.
   */
  language_preference: z.string().optional(),

  /**
   * Additional web search configuration.
   */
  web_search_options: z
    .looseObject({
      /**
       * Controls the size of search context injected into the model.
       */
      search_context_size: z.enum(['low', 'medium', 'high']).optional(),

      /**
       * Controls whether to use fast search, pro search, or automatic routing.
       */
      search_type: z.enum(['fast', 'pro', 'auto']).optional(),

      /**
       * User location for search result personalization.
       */
      user_location: z
        .looseObject({
          latitude: z.number().optional(),
          longitude: z.number().optional(),
          country: z.string().optional(),
          city: z.string().optional(),
          region: z.string().optional(),
        })
        .optional(),

      /**
       * If true, applies enhanced relevance filtering to image results.
       */
      image_results_enhanced_relevance: z.boolean().optional(),
    })
    .optional(),
});

export type PerplexityLanguageModelOptions = z.infer<
  typeof perplexityLanguageModelOptions
>;
