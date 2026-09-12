import 'dotenv/config';
import { expect } from 'vitest';
import {
  fireworks as provider,
  type FireworksErrorData,
} from '@ai-sdk/fireworks';
import type { APICallError } from '@ai-sdk/provider';
import {
  createEmbeddingModelWithCapabilities,
  createFeatureTestSuite,
  createImageModelWithCapabilities,
  createLanguageModelWithCapabilities,
} from './feature-test-suite';

const createChatModel = (modelId: string) =>
  createLanguageModelWithCapabilities(provider.chatModel(modelId));

const createCompletionModel = (modelId: string) =>
  createLanguageModelWithCapabilities(provider.completionModel(modelId), [
    'textCompletion',
  ]);

createFeatureTestSuite({
  name: 'Fireworks',
  models: {
    invalidModel: provider.chatModel('no-such-model'),
    languageModels: [
      // createChatModel('accounts/fireworks/models/deepseek-v3'),
      createChatModel('accounts/fireworks/models/llama-v3p3-70b-instruct'),
      // createChatModel('accounts/fireworks/models/mixtral-8x7b-instruct'),
      // createChatModel('accounts/fireworks/models/qwen2p5-72b-instruct'),
      // createCompletionModel('accounts/fireworks/models/llama-v3-8b-instruct'),
      createCompletionModel(
        'accounts/fireworks/models/llama-v3p2-11b-vision-instruct',
      ),
    ],
    embeddingModels: [
      createEmbeddingModelWithCapabilities(
        provider.embeddingModel('nomic-ai/nomic-embed-text-v1.5'),
      ),
    ],
    imageModels: [
      createImageModelWithCapabilities(
        provider.image('accounts/fireworks/models/flux-1-dev-fp8'),
      ),
    ],
  },
  timeout: 10000,
  customAssertions: {
    errorValidator: (error: APICallError) => {
      expect((error.data as FireworksErrorData).error).toBe(
        'Model not found, inaccessible, and/or not deployed',
      );
    },
  },
})();
