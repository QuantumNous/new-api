import { groq as provider } from '@ai-sdk/groq';
import {
  createFeatureTestSuite,
  createLanguageModelWithCapabilities,
} from './feature-test-suite';
import 'dotenv/config';

const createChatModel = (modelId: string) =>
  createLanguageModelWithCapabilities(provider.languageModel(modelId));

createFeatureTestSuite({
  name: 'Groq',
  models: {
    languageModels: [
      createChatModel('deepseek-r1-distill-llama-70b'),
      createChatModel('llama-3.1-8b-instant'),
      createChatModel('llama-3.3-70b-versatile'),
      createChatModel('qwen-qwq-32b'),
    ],
  },
  timeout: 30000,
})();
