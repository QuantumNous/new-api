import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { createFireworks } from './fireworks-provider';
import { loadApiKey } from '@ai-sdk/provider-utils';
import {
  OpenAICompatibleChatLanguageModel,
  OpenAICompatibleCompletionLanguageModel,
  OpenAICompatibleEmbeddingModel,
} from '@ai-sdk/openai-compatible';
import { FireworksImageModel } from './fireworks-image-model';

// Add type assertion for the mocked class
const OpenAICompatibleChatLanguageModelMock =
  OpenAICompatibleChatLanguageModel as unknown as Mock;

vi.mock('@ai-sdk/openai-compatible', () => {
  // Create mock constructor functions that behave like classes
  const createMockConstructor = (providerName: string) => {
    const mockConstructor = vi.fn().mockImplementation(function (
      this: any,
      modelId: string,
      settings: any,
    ) {
      this.provider = providerName;
      this.modelId = modelId;
      this.settings = settings;
    });
    return mockConstructor;
  };

  return {
    OpenAICompatibleChatLanguageModel: createMockConstructor('fireworks.chat'),
    OpenAICompatibleCompletionLanguageModel: createMockConstructor(
      'fireworks.completion',
    ),
    OpenAICompatibleEmbeddingModel: createMockConstructor(
      'fireworks.embedding',
    ),
  };
});

vi.mock('@ai-sdk/provider-utils', async () => {
  const actual = await vi.importActual('@ai-sdk/provider-utils');
  return {
    ...actual,
    loadApiKey: vi.fn().mockReturnValue('mock-api-key'),
    withoutTrailingSlash: vi.fn(url => url),
  };
});

vi.mock('./fireworks-image-model', () => ({
  FireworksImageModel: vi.fn(),
}));

describe('FireworksProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createFireworks', () => {
    it('should create a FireworksProvider instance with default options', () => {
      const provider = createFireworks();
      const model = provider('model-id');

      // Use the mocked version
      const constructorCall =
        OpenAICompatibleChatLanguageModelMock.mock.calls[0];
      const config = constructorCall[1];
      config.headers();

      expect(loadApiKey).toHaveBeenCalledWith({
        apiKey: undefined,
        environmentVariableName: 'FIREWORKS_API_KEY',
        description: 'Fireworks API key',
      });
    });

    it('should create a FireworksProvider instance with custom options', () => {
      const options = {
        apiKey: 'custom-key',
        baseURL: 'https://custom.url',
        headers: { 'Custom-Header': 'value' },
      };
      const provider = createFireworks(options);
      const model = provider('model-id');

      const constructorCall =
        OpenAICompatibleChatLanguageModelMock.mock.calls[0];
      const config = constructorCall[1];
      config.headers();

      expect(loadApiKey).toHaveBeenCalledWith({
        apiKey: 'custom-key',
        environmentVariableName: 'FIREWORKS_API_KEY',
        description: 'Fireworks API key',
      });
    });

    it('should return a chat model when called as a function', () => {
      const provider = createFireworks();
      const modelId = 'foo-model-id';

      const model = provider(modelId);
      expect(model).toBeInstanceOf(OpenAICompatibleChatLanguageModel);
    });
  });

  describe('chatModel', () => {
    it('should construct a chat model with correct configuration', () => {
      const provider = createFireworks();
      const modelId = 'fireworks-chat-model';

      const model = provider.chatModel(modelId);

      expect(model).toBeInstanceOf(OpenAICompatibleChatLanguageModel);
    });

    it('should set includeUsage so streaming responses report token usage', () => {
      const provider = createFireworks();
      provider.chatModel('test-model');

      const config = OpenAICompatibleChatLanguageModelMock.mock.calls[0][1];
      expect(config.includeUsage).toBe(true);
    });

    it('should pass transformRequestBody that converts thinking options', () => {
      const provider = createFireworks();
      provider.chatModel('test-model');

      const constructorCall =
        OpenAICompatibleChatLanguageModelMock.mock.calls[0];
      const config = constructorCall[1];
      const transformRequestBody = config.transformRequestBody;

      const result = transformRequestBody({
        model: 'test-model',
        messages: [],
        thinking: { type: 'enabled', budgetTokens: 2048 },
        reasoningHistory: 'interleaved',
      });

      expect(result).toEqual({
        model: 'test-model',
        messages: [],
        thinking: { type: 'enabled', budget_tokens: 2048 },
        reasoning_history: 'interleaved',
      });
    });

    it('should handle thinking without budgetTokens', () => {
      const provider = createFireworks();
      provider.chatModel('test-model');

      const constructorCall =
        OpenAICompatibleChatLanguageModelMock.mock.calls[0];
      const config = constructorCall[1];
      const transformRequestBody = config.transformRequestBody;

      const result = transformRequestBody({
        model: 'test-model',
        messages: [],
        thinking: { type: 'enabled' },
      });

      expect(result).toEqual({
        model: 'test-model',
        messages: [],
        thinking: { type: 'enabled' },
      });
    });

    it('should map promptCacheKey to prompt_cache_key', () => {
      const provider = createFireworks();
      provider.chatModel('test-model');

      const constructorCall =
        OpenAICompatibleChatLanguageModelMock.mock.calls[0];
      const config = constructorCall[1];
      const transformRequestBody = config.transformRequestBody;

      const result = transformRequestBody({
        model: 'test-model',
        messages: [],
        promptCacheKey: 'session-123',
      });

      expect(result).toEqual({
        model: 'test-model',
        messages: [],
        prompt_cache_key: 'session-123',
      });
      expect(result).not.toHaveProperty('promptCacheKey');
    });

    it('should prefer promptCacheKey over raw prompt_cache_key', () => {
      const provider = createFireworks();
      provider.chatModel('test-model');

      const constructorCall =
        OpenAICompatibleChatLanguageModelMock.mock.calls[0];
      const config = constructorCall[1];
      const transformRequestBody = config.transformRequestBody;

      const result = transformRequestBody({
        model: 'test-model',
        messages: [],
        prompt_cache_key: 'raw-session',
        promptCacheKey: 'typed-session',
      });

      expect(result).toEqual({
        model: 'test-model',
        messages: [],
        prompt_cache_key: 'typed-session',
      });
    });

    it('should map serviceTier to service_tier', () => {
      const provider = createFireworks();
      provider.chatModel('test-model');

      const constructorCall =
        OpenAICompatibleChatLanguageModelMock.mock.calls[0];
      const config = constructorCall[1];
      const transformRequestBody = config.transformRequestBody;

      const result = transformRequestBody({
        model: 'test-model',
        messages: [],
        serviceTier: 'priority',
      });

      expect(result).toEqual({
        model: 'test-model',
        messages: [],
        service_tier: 'priority',
      });
      expect(result).not.toHaveProperty('serviceTier');
    });

    it('should prefer serviceTier over raw service_tier', () => {
      const provider = createFireworks();
      provider.chatModel('test-model');

      const constructorCall =
        OpenAICompatibleChatLanguageModelMock.mock.calls[0];
      const config = constructorCall[1];
      const transformRequestBody = config.transformRequestBody;

      const result = transformRequestBody({
        model: 'test-model',
        messages: [],
        service_tier: 'standard',
        serviceTier: 'priority',
      });

      expect(result).toEqual({
        model: 'test-model',
        messages: [],
        service_tier: 'priority',
      });
    });

    it('should remap reasoning_effort xhigh to high', () => {
      const provider = createFireworks();
      provider.chatModel('test-model');

      const constructorCall =
        OpenAICompatibleChatLanguageModelMock.mock.calls[0];
      const config = constructorCall[1];
      const transformRequestBody = config.transformRequestBody;

      const result = transformRequestBody({
        model: 'test-model',
        messages: [],
        reasoning_effort: 'xhigh',
      });

      expect(result).toEqual({
        model: 'test-model',
        messages: [],
        reasoning_effort: 'high',
      });
    });

    it('should remap reasoning_effort minimal to low', () => {
      const provider = createFireworks();
      provider.chatModel('test-model');

      const constructorCall =
        OpenAICompatibleChatLanguageModelMock.mock.calls[0];
      const config = constructorCall[1];
      const transformRequestBody = config.transformRequestBody;

      const result = transformRequestBody({
        model: 'test-model',
        messages: [],
        reasoning_effort: 'minimal',
      });

      expect(result).toEqual({
        model: 'test-model',
        messages: [],
        reasoning_effort: 'low',
      });
    });

    it('should pass through supported reasoning_effort values unchanged', () => {
      const provider = createFireworks();
      provider.chatModel('test-model');

      const constructorCall =
        OpenAICompatibleChatLanguageModelMock.mock.calls[0];
      const config = constructorCall[1];
      const transformRequestBody = config.transformRequestBody;

      const result = transformRequestBody({
        model: 'test-model',
        messages: [],
        reasoning_effort: 'medium',
      });

      expect(result).toEqual({
        model: 'test-model',
        messages: [],
        reasoning_effort: 'medium',
      });
    });

    it('should handle request without thinking options', () => {
      const provider = createFireworks();
      provider.chatModel('test-model');

      const constructorCall =
        OpenAICompatibleChatLanguageModelMock.mock.calls[0];
      const config = constructorCall[1];
      const transformRequestBody = config.transformRequestBody;

      const result = transformRequestBody({
        model: 'test-model',
        messages: [],
      });

      expect(result).toEqual({
        model: 'test-model',
        messages: [],
      });
    });
  });

  describe('completionModel', () => {
    it('should construct a completion model with correct configuration', () => {
      const provider = createFireworks();
      const modelId = 'fireworks-completion-model';

      const model = provider.completionModel(modelId);

      expect(model).toBeInstanceOf(OpenAICompatibleCompletionLanguageModel);
    });

    it('should set includeUsage so streaming responses report token usage', () => {
      const provider = createFireworks();
      provider.completionModel('test-model');

      const config = (
        OpenAICompatibleCompletionLanguageModel as unknown as Mock
      ).mock.calls[0][1];
      expect(config.includeUsage).toBe(true);
    });
  });

  describe('embeddingModel', () => {
    it('should construct a text embedding model with correct configuration', () => {
      const provider = createFireworks();
      const modelId = 'fireworks-embedding-model';

      const model = provider.embeddingModel(modelId);

      expect(model).toBeInstanceOf(OpenAICompatibleEmbeddingModel);
    });
  });

  describe('image', () => {
    it('should construct an image model with correct configuration', () => {
      const provider = createFireworks();
      const modelId = 'accounts/fireworks/models/flux-1-dev-fp8';

      const model = provider.image(modelId);

      expect(model).toBeInstanceOf(FireworksImageModel);
      expect(FireworksImageModel).toHaveBeenCalledWith(
        modelId,
        expect.objectContaining({
          provider: 'fireworks.image',
          baseURL: 'https://api.fireworks.ai/inference/v1',
        }),
      );
    });

    it('should use default settings when none provided', () => {
      const provider = createFireworks();
      const modelId = 'accounts/fireworks/models/flux-1-dev-fp8';

      const model = provider.image(modelId);

      expect(model).toBeInstanceOf(FireworksImageModel);
      expect(FireworksImageModel).toHaveBeenCalledWith(
        modelId,
        expect.any(Object),
      );
    });

    it('should respect custom baseURL', () => {
      const customBaseURL = 'https://custom.api.fireworks.ai';
      const provider = createFireworks({ baseURL: customBaseURL });
      const modelId = 'accounts/fireworks/models/flux-1-dev-fp8';

      provider.image(modelId);

      expect(FireworksImageModel).toHaveBeenCalledWith(
        modelId,
        expect.objectContaining({
          baseURL: customBaseURL,
        }),
      );
    });
  });
});
