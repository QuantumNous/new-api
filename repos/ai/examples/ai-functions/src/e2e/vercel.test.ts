import 'dotenv/config';
import { expect } from 'vitest';
import { vercel as provider } from '@ai-sdk/vercel';
import type { APICallError } from 'ai';
import {
  createFeatureTestSuite,
  createLanguageModelWithCapabilities,
} from './feature-test-suite';

const createChatModel = (modelId: string) =>
  createLanguageModelWithCapabilities(provider(modelId), [
    'textCompletion',
    'objectGeneration',
  ]);

createFeatureTestSuite({
  name: 'Vercel',
  models: {
    invalidModel: provider('no-such-model'),
    languageModels: [createChatModel('v0-1.5-md')],
  },
  timeout: 30000,
  customAssertions: {
    errorValidator: (error: APICallError) => {
      expect(error.message).toMatch(/model.*not found|invalid.*model/i);
    },
  },
})();
