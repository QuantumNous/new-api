import { openai as provider } from '@ai-sdk/openai';
import type { LanguageModelV3, LanguageModelV4 } from '@ai-sdk/provider';
import type { APICallError } from 'ai';
import 'dotenv/config';
import { expect } from 'vitest';
import {
  createEmbeddingModelWithCapabilities,
  createFeatureTestSuite,
  createLanguageModelWithCapabilities,
  type ModelWithCapabilities,
} from './feature-test-suite';
const createChatModel = (
  modelId: string,
): ModelWithCapabilities<LanguageModelV3 | LanguageModelV4> =>
  createLanguageModelWithCapabilities(provider.chat(modelId));

createFeatureTestSuite({
  name: 'OpenAI',
  models: {
    invalidModel: provider.chat('no-such-model'),
    languageModels: [
      createChatModel('gpt-4.1'),
      createChatModel('gpt-4.1-mini'),
      createChatModel('gpt-4.1-nano'),
      createChatModel('o3'),
      createChatModel('o4-mini'),
      createChatModel('gpt-4o-mini'),
      createChatModel('gpt-3.5-turbo'),
      createChatModel('gpt-5'),
      createChatModel('gpt-5-mini'),
      createChatModel('gpt-5-nano'),
    ],
    embeddingModels: [
      createEmbeddingModelWithCapabilities(
        provider.embeddingModel('text-embedding-3-small'),
      ),
    ],
  },
  timeout: 30000,
  customAssertions: {
    skipUsage: false,
    errorValidator: (error: APICallError) => {
      expect(error.message).toMatch(/The model .* does not exist/);
    },
  },
})();
