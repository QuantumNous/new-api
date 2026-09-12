import 'dotenv/config';
import { expect } from 'vitest';
import { perplexity as provider } from '@ai-sdk/perplexity';
import {
  createFeatureTestSuite,
  createLanguageModelWithCapabilities,
} from './feature-test-suite';
import type { APICallError } from '@ai-sdk/provider';

const createChatModel = (modelId: string) =>
  createLanguageModelWithCapabilities(provider(modelId));

createFeatureTestSuite({
  name: 'perplexity',
  models: {
    invalidModel: provider('no-such-model'),
    languageModels: [createChatModel('sonar-pro'), createChatModel('sonar')],
  },
  timeout: 30000,
  customAssertions: {
    errorValidator: (error: APICallError) => {
      expect((error.data as any).code).toBe(
        'Some requested entity was not found',
      );
    },
  },
})();
