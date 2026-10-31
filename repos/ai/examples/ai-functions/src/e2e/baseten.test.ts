import 'dotenv/config';
import { expect } from 'vitest';
import { baseten as provider } from '@ai-sdk/baseten';
import type { APICallError } from 'ai';
import {
  createFeatureTestSuite,
  createLanguageModelWithCapabilities,
} from './feature-test-suite';

const createChatModel = (modelId: string) =>
  createLanguageModelWithCapabilities(provider.chatModel(modelId), [
    'textCompletion',
    'objectGeneration',
  ]);

createFeatureTestSuite({
  name: 'Baseten',
  models: {
    invalidModel: provider.chatModel('no-such-model'),
    languageModels: [createChatModel('deepseek-ai/DeepSeek-V3-0324')],
  },
  timeout: 60000,
  customAssertions: {
    errorValidator: (error: APICallError) => {
      expect(error.message).toMatch(/model.*not found|invalid.*model|error/i);
    },
  },
})();
