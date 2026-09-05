import 'dotenv/config';
import { expect } from 'vitest';
import { mistral as provider } from '@ai-sdk/mistral';
import type { APICallError } from 'ai';
import {
  createFeatureTestSuite,
  createLanguageModelWithCapabilities,
  createEmbeddingModelWithCapabilities,
} from './feature-test-suite';

const createChatModel = (modelId: string) =>
  createLanguageModelWithCapabilities(provider.chat(modelId));

createFeatureTestSuite({
  name: 'Mistral',
  models: {
    invalidModel: provider.chat('no-such-model'),
    languageModels: [
      createChatModel('mistral-small-latest'),
      createChatModel('mistral-large-latest'),
    ],
    embeddingModels: [
      createEmbeddingModelWithCapabilities(
        provider.embeddingModel('mistral-embed'),
      ),
    ],
  },
  timeout: 30000,
  customAssertions: {
    errorValidator: (error: APICallError) => {
      expect(error.message).toMatch(/model.*not found|invalid.*model/i);
    },
  },
})();
