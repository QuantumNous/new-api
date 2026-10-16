import { google as provider, type GoogleErrorData } from '@ai-sdk/google';
import type {
  APICallError,
  LanguageModelV3,
  LanguageModelV4,
} from '@ai-sdk/provider';
import 'dotenv/config';
import { expect } from 'vitest';
import {
  createEmbeddingModelWithCapabilities,
  createFeatureTestSuite,
  createLanguageModelWithCapabilities,
  createImageModelWithCapabilities,
  defaultChatModelCapabilities,
  type ModelWithCapabilities,
} from './feature-test-suite';
import { defaultSettingsMiddleware, wrapLanguageModel } from 'ai';

const createChatModel = (modelId: string) =>
  createLanguageModelWithCapabilities(provider.chat(modelId));

const createImageModel = (modelId: string) =>
  createImageModelWithCapabilities(provider.image(modelId));

const createSearchGroundedModel = (
  modelId: string,
): ModelWithCapabilities<LanguageModelV3 | LanguageModelV4> => {
  const model = provider.chat(modelId);
  return {
    model: wrapLanguageModel({
      model,
      middleware: defaultSettingsMiddleware({
        settings: {
          tools: [
            {
              type: 'provider',
              id: 'google.google_search',
              name: 'google_search',
              args: {},
            },
          ],
        },
      }),
    }),
    capabilities: [...defaultChatModelCapabilities, 'searchGrounding'],
  };
};

createFeatureTestSuite({
  name: 'Google',
  models: {
    invalidModel: provider.chat('no-such-model'),
    languageModels: [
      createSearchGroundedModel('gemini-2.5-flash'),
      createChatModel('gemini-2.5-flash'),
      // Gemini 2.0 and Pro models have low quota limits and may require billing enabled.
      // createChatModel('gemini-2.5-flash-image'),
      // createSearchGroundedModel('gemini-2.5-flash-image'),
      // createChatModel('gemini-2.5-pro'),
      // createChatModel('gemini-1.0-pro'),
    ],
    embeddingModels: [
      createEmbeddingModelWithCapabilities(
        provider.embeddingModel('gemini-embedding-001'),
      ),
      createEmbeddingModelWithCapabilities(
        provider.embeddingModel('gemini-embedding-2-preview'),
      ),
    ],
    imageModels: [createImageModel('imagen-3.0-generate-002')],
  },
  timeout: 20000,
  customAssertions: {
    skipUsage: true,
    errorValidator: (error: APICallError) => {
      console.log(error);
      expect((error.data as GoogleErrorData).error.message).match(
        /models\/no\-such\-model is not found/,
      );
    },
  },
})();
