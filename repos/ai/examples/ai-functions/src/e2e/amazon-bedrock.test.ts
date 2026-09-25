import 'dotenv/config';
import { expect } from 'vitest';
import { amazonBedrock as provider } from '@ai-sdk/amazon-bedrock';
import type { APICallError } from 'ai';
import {
  createFeatureTestSuite,
  createLanguageModelWithCapabilities,
  createEmbeddingModelWithCapabilities,
  defaultChatModelCapabilities,
} from './feature-test-suite';

const createChatModel = (
  modelId: string,
  capabilities = defaultChatModelCapabilities,
) => createLanguageModelWithCapabilities(provider(modelId), capabilities);

createFeatureTestSuite({
  name: 'Amazon Bedrock',
  models: {
    invalidModel: provider('no-such-model'),
    languageModels: [
      createChatModel('meta.llama3-1-8b-instruct-v1:0', [
        'textCompletion',
        'toolCalls',
      ]),
      createChatModel('amazon.titan-text-express-v1', ['textCompletion']),
    ],
    embeddingModels: [
      createEmbeddingModelWithCapabilities(
        provider.embeddingModel('amazon.titan-embed-text-v2:0'),
      ),
    ],
  },
  timeout: 60000,
  customAssertions: {
    errorValidator: (error: APICallError) => {
      expect(error.message).toMatch(/model|resource|not found|invalid/i);
    },
  },
})();
