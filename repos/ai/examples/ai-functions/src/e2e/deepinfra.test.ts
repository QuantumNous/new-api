import 'dotenv/config';
import { deepInfra as provider } from '@ai-sdk/deepinfra';
import {
  createEmbeddingModelWithCapabilities,
  createFeatureTestSuite,
  createLanguageModelWithCapabilities,
} from './feature-test-suite';

const createChatModel = (modelId: string) =>
  createLanguageModelWithCapabilities(provider.chatModel(modelId));

createFeatureTestSuite({
  name: 'DeepInfra',
  models: {
    languageModels: [
      createChatModel('meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8'),
      createChatModel('meta-llama/Llama-4-Scout-17B-16E-Instruct'),
      createChatModel('deepseek-ai/DeepSeek-V3'),
      createChatModel('deepseek-ai/DeepSeek-R1'),
      createChatModel('deepseek-ai/DeepSeek-R1-Distill-Llama-70B'),
      createChatModel('deepseek-ai/DeepSeek-R1-Turbo'),
      createChatModel('google/codegemma-7b-it'),
      createChatModel('google/gemma-2-9b-it'),
      createChatModel('meta-llama/Llama-3.2-11B-Vision-Instruct'),
      createChatModel('meta-llama/Llama-3.2-90B-Vision-Instruct'),
      createChatModel('meta-llama/Llama-3.3-70B-Instruct-Turbo'),
      createChatModel('meta-llama/Llama-3.3-70B-Instruct'),
      createChatModel('meta-llama/Meta-Llama-3.1-405B-Instruct'),
      createChatModel('meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo'),
      createChatModel('meta-llama/Meta-Llama-3.1-70B-Instruct'),
      createChatModel('meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo'),
      createChatModel('meta-llama/Meta-Llama-3.1-8B-Instruct'),
      createChatModel('microsoft/WizardLM-2-8x22B'),
      createChatModel('mistralai/Mixtral-8x7B-Instruct-v0.1'),
      createChatModel('nvidia/Llama-3.1-Nemotron-70B-Instruct'),
      createChatModel('Qwen/Qwen2-7B-Instruct'),
      createChatModel('Qwen/Qwen2.5-72B-Instruct'),
      createChatModel('Qwen/Qwen2.5-Coder-32B-Instruct'),
      createChatModel('Qwen/QwQ-32B-Preview'),
    ],
    embeddingModels: [
      createEmbeddingModelWithCapabilities(
        provider.embeddingModel('BAAI/bge-base-en-v1.5'),
      ),
      createEmbeddingModelWithCapabilities(
        provider.embeddingModel('intfloat/e5-base-v2'),
      ),
      createEmbeddingModelWithCapabilities(
        provider.embeddingModel('sentence-transformers/all-mpnet-base-v2'),
      ),
    ],
  },
  timeout: 60000,
})();
