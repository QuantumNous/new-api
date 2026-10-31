import 'dotenv/config';
import { gateway as provider } from '@ai-sdk/gateway';
import {
  createFeatureTestSuite,
  createLanguageModelWithCapabilities,
} from './feature-test-suite';

const createChatModel = (modelId: string) =>
  createLanguageModelWithCapabilities(provider.languageModel(modelId));

createFeatureTestSuite({
  name: 'Gateway',
  models: {
    languageModels: [createChatModel('xai/grok-3-beta')],
  },
  timeout: 30000,
})();
