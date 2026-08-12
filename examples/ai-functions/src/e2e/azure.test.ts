import 'dotenv/config';
import { describe, expect, it } from 'vitest';
import { azure as provider, createAzure } from '@ai-sdk/azure';
import { generateText, type APICallError } from 'ai';
import {
  createFeatureTestSuite,
  createLanguageModelWithCapabilities,
  createEmbeddingModelWithCapabilities,
} from './feature-test-suite';

const createChatModel = (deploymentId: string) =>
  createLanguageModelWithCapabilities(provider.chat(deploymentId));

createFeatureTestSuite({
  name: 'Azure OpenAI',
  models: {
    invalidModel: provider.chat('no-such-deployment'),
    languageModels: [
      createChatModel(process.env.AZURE_OPENAI_DEPLOYMENT_NAME ?? 'gpt-4o'),
    ],
    embeddingModels: process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME
      ? [
          createEmbeddingModelWithCapabilities(
            provider.embeddingModel(
              process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME,
            ),
          ),
        ]
      : [],
  },
  timeout: 30000,
  customAssertions: {
    errorValidator: (error: APICallError) => {
      expect(error.message).toMatch(
        /deployment.*not found|invalid|does not exist/i,
      );
    },
  },
})();

describe.skipIf(
  !process.env.AZURE_RESOURCE_NAME || !process.env.AZURE_OPENAI_AD_TOKEN,
)('Azure OpenAI Microsoft Entra ID E2E Tests', () => {
  it('should generate text with tokenProvider', async () => {
    const azure = createAzure({
      resourceName: process.env.AZURE_RESOURCE_NAME!,
      tokenProvider: async () => process.env.AZURE_OPENAI_AD_TOKEN!,
    });

    const result = await generateText({
      model: azure(process.env.AZURE_OPENAI_DEPLOYMENT_NAME ?? 'gpt-4o'),
      prompt: 'Write one short sentence about TypeScript.',
    });

    expect(result.text).toBeTruthy();
  });
});
