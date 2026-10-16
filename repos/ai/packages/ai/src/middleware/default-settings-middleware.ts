import type { LanguageModelV4CallOptions } from '@ai-sdk/provider';
import type { LanguageModelMiddleware } from '../types';
import { mergeObjects } from '../util/merge-objects';

/**
 * Applies default settings for a language model.
 */
export function defaultSettingsMiddleware({
  settings,
}: {
  settings: Partial<{
    maxOutputTokens?: LanguageModelV4CallOptions['maxOutputTokens'];
    temperature?: LanguageModelV4CallOptions['temperature'];
    stopSequences?: LanguageModelV4CallOptions['stopSequences'];
    topP?: LanguageModelV4CallOptions['topP'];
    topK?: LanguageModelV4CallOptions['topK'];
    presencePenalty?: LanguageModelV4CallOptions['presencePenalty'];
    frequencyPenalty?: LanguageModelV4CallOptions['frequencyPenalty'];
    responseFormat?: LanguageModelV4CallOptions['responseFormat'];
    seed?: LanguageModelV4CallOptions['seed'];
    tools?: LanguageModelV4CallOptions['tools'];
    toolChoice?: LanguageModelV4CallOptions['toolChoice'];
    headers?: LanguageModelV4CallOptions['headers'];
    providerOptions?: LanguageModelV4CallOptions['providerOptions'];
  }>;
}): LanguageModelMiddleware {
  return {
    specificationVersion: 'v4',
    transformParams: async ({ params }) => {
      return mergeObjects(settings, params) as LanguageModelV4CallOptions;
    },
  };
}
