import 'dotenv/config';
import { expect } from 'vitest';
import { anthropic as provider } from '@ai-sdk/anthropic';
import type { APICallError } from 'ai';
import {
  createFeatureTestSuite,
  createLanguageModelWithCapabilities,
} from './feature-test-suite';

const createChatModel = (modelId: string) =>
  createLanguageModelWithCapabilities(provider.chat(modelId));

createFeatureTestSuite({
  name: 'Anthropic',
  models: {
    invalidModel: provider.chat('no-such-model'),
    languageModels: [
      createChatModel('claude-sonnet-4-20250514'),
      createChatModel('claude-haiku-4-5-20251001'),
    ],
  },
  timeout: 30000,
  customAssertions: {
    errorValidator: (error: APICallError) => {
      expect(error.message).toMatch(/model:/i);
    },
  },
})();
