import 'dotenv/config';
import { cohere as provider } from '@ai-sdk/cohere';
import {
  createFeatureTestSuite,
  createLanguageModelWithCapabilities,
} from './feature-test-suite';

const createChatModel = (modelId: string) =>
  createLanguageModelWithCapabilities(provider.languageModel(modelId));

createFeatureTestSuite({
  name: 'Cohere',
  models: {
    languageModels: [
      createChatModel('command-a-03-2025'),
      createChatModel('command-r-plus'),
      createChatModel('command-r'),
      createChatModel('command'),
      createChatModel('command-light'),
    ],
  },
  timeout: 30000,
})();
