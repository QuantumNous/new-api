import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { createBaseten } from './baseten-provider';
import {
  LanguageModelV4,
  EmbeddingModelV4,
  NoSuchModelError,
} from '@ai-sdk/provider';
import { loadApiKey } from '@ai-sdk/provider-utils';
import {
  OpenAICompatibleChatLanguageModel,
  OpenAICompatibleEmbeddingModel,
} from '@ai-sdk/openai-compatible';

// Mock the OpenAI-compatible classes
const OpenAICompatibleChatLanguageModelMock =
  OpenAICompatibleChatLanguageModel as unknown as Mock;
const OpenAICompatibleEmbeddingModelMock =
  OpenAICompatibleEmbeddingModel as unknown as Mock;

vi.mock('@ai-sdk/openai-compatible', () => {
  const createMockConstructor = (providerName: string) => {
    const mockConstructor = vi.fn().mockImplementation(function (
      this: any,
      modelId: string,
      settings: any,
    ) {
      this.provider = providerName;
      this.modelId = modelId;
      this.settings = settings;
      this.doGenerate = vi.fn();
      this.doEmbed = vi.fn();
    });
    return mockConstructor;
  };

  return {
    OpenAICompatibleChatLanguageModel: createMockConstructor('baseten.chat'),
    OpenAICompatibleEmbeddingModel: createMockConstructor('baseten.embedding'),
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

vi.mock('@basetenlabs/performance-client', () => ({
  PerformanceClient: vi.fn(function () {
    return {
      embed: vi.fn(),
      embedBatch: vi.fn(),
    };
  }),
}));

vi.mock('./version', () => ({
  VERSION: '0.0.0-test',
}));

describe('BasetenProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createBaseten', () => {
    it('should create a BasetenProvider instance with default options', () => {
      const provider = createBaseten();
      const model = provider.chatModel('deepseek-ai/DeepSeek-V3-0324');

      const constructorCall =
        OpenAICompatibleChatLanguageModelMock.mock.calls[0];
      const config = constructorCall[1];
      const headers = config.headers();

      expect(loadApiKey).toHaveBeenCalledWith({
        apiKey: undefined,
        environmentVariableName: 'BASETEN_API_KEY',
        description: 'Baseten API key',
      });
      expect(headers.authorization).toBe('Bearer mock-api-key');
      expect(config.provider).toBe('baseten.chat');
    });

    it('should create a BasetenProvider instance with custom options', () => {
      const options = {
        apiKey: 'custom-key',
        baseURL: 'https://custom.url',
        headers: { 'Custom-Header': 'value' },
      };
      const provider = createBaseten(options);
      const model = provider.chatModel('deepseek-ai/DeepSeek-V3-0324');

      const constructorCall =
        OpenAICompatibleChatLanguageModelMock.mock.calls[0];
      const config = constructorCall[1];
      const headers = config.headers();

      expect(loadApiKey).toHaveBeenCalledWith({
        apiKey: 'custom-key',
        environmentVariableName: 'BASETEN_API_KEY',
        description: 'Baseten API key',
      });
      expect(headers['custom-header']).toBe('value');
    });

    it('should support optional modelId parameter', () => {
      const provider = createBaseten();

      // Should work without modelId
      const model1 = provider();
      expect(model1).toBeInstanceOf(OpenAICompatibleChatLanguageModel);

      // Should work with modelId
      const model2 = provider('deepseek-ai/DeepSeek-V3-0324');
      expect(model2).toBeInstanceOf(OpenAICompatibleChatLanguageModel);
    });
  });

  describe('chatModel', () => {
    it('should construct a chat model with correct configuration for default Model APIs', () => {
      const provider = createBaseten();
      const modelId = 'deepseek-ai/DeepSeek-V3-0324';

      const model = provider.chatModel(modelId);

      expect(model).toBeInstanceOf(OpenAICompatibleChatLanguageModel);
      expect(OpenAICompatibleChatLanguageModelMock).toHaveBeenCalledWith(
        modelId,
        expect.objectContaining({
          provider: 'baseten.chat',
          errorStructure: expect.any(Object),
        }),
      );
    });

    it('should construct a chat model with optional modelId', () => {
      const provider = createBaseten();

      // Should work without modelId
      const model1 = provider.chatModel();
      expect(model1).toBeInstanceOf(OpenAICompatibleChatLanguageModel);
      expect(OpenAICompatibleChatLanguageModelMock).toHaveBeenCalledWith(
        'chat',
        expect.any(Object),
      );

      // Should work with modelId
      const model2 = provider.chatModel('deepseek-ai/DeepSeek-V3-0324');
      expect(model2).toBeInstanceOf(OpenAICompatibleChatLanguageModel);
    });

    it('should handle /sync/v1 endpoints correctly', () => {
      const provider = createBaseten({
        modelURL:
          'https://model-123.api.baseten.co/environments/production/sync/v1',
      });

      const model = provider.chatModel();

      expect(model).toBeInstanceOf(OpenAICompatibleChatLanguageModel);
      expect(OpenAICompatibleChatLanguageModelMock).toHaveBeenCalledWith(
        'placeholder',
        expect.objectContaining({
          provider: 'baseten.chat',
          url: expect.any(Function),
          errorStructure: expect.any(Object),
        }),
      );

      // Test URL construction
      const constructorCall =
        OpenAICompatibleChatLanguageModelMock.mock.calls[0];
      const config = constructorCall[1];
      const url = config.url({ path: '/chat/completions' });
      expect(url).toBe(
        'https://model-123.api.baseten.co/environments/production/sync/v1/chat/completions',
      );
    });

    it('should throw error for /predict endpoints with chat models', () => {
      const provider = createBaseten({
        modelURL:
          'https://model-123.api.baseten.co/environments/production/predict',
      });

      expect(() => {
        provider.chatModel();
      }).toThrow(
        'Not supported. You must use a /sync/v1 endpoint for chat models.',
      );
    });
  });

  describe('languageModel', () => {
    it('should be an alias for chatModel', () => {
      const provider = createBaseten();
      const modelId = 'deepseek-ai/DeepSeek-V3-0324';

      const chatModel = provider.chatModel(modelId);
      const languageModel = provider.languageModel(modelId);

      expect(chatModel).toBeInstanceOf(OpenAICompatibleChatLanguageModel);
      expect(languageModel).toBeInstanceOf(OpenAICompatibleChatLanguageModel);
    });

    it('should support optional modelId parameter', () => {
      const provider = createBaseten();

      const model1 = provider.languageModel();
      expect(model1).toBeInstanceOf(OpenAICompatibleChatLanguageModel);

      const model2 = provider.languageModel('deepseek-ai/DeepSeek-V3-0324');
      expect(model2).toBeInstanceOf(OpenAICompatibleChatLanguageModel);
    });
  });

  describe('textEmbeddingModel', () => {
    it('should throw error when no modelURL is provided', () => {
      const provider = createBaseten();

      expect(() => {
        provider.embeddingModel();
      }).toThrow(
        'No model URL provided for embeddings. Please set modelURL option for embeddings.',
      );
    });

    it('should construct embedding model for /sync endpoints', () => {
      const provider = createBaseten({
        modelURL:
          'https://model-123.api.baseten.co/environments/production/sync',
      });

      const model = provider.embeddingModel();

      expect(model).toBeInstanceOf(OpenAICompatibleEmbeddingModel);
      expect(OpenAICompatibleEmbeddingModelMock).toHaveBeenCalledWith(
        'embeddings',
        expect.objectContaining({
          provider: 'baseten.embedding',
          url: expect.any(Function),
          errorStructure: expect.any(Object),
        }),
      );

      // Test URL construction for embeddings (Performance Client adds /v1/embeddings)
      const constructorCall = OpenAICompatibleEmbeddingModelMock.mock.calls[0];
      const config = constructorCall[1];
      const url = config.url({ path: '/embeddings' });
      expect(url).toBe(
        'https://model-123.api.baseten.co/environments/production/sync/v1/embeddings',
      );
    });

    it('should throw error for /predict endpoints (not supported with Performance Client)', () => {
      const provider = createBaseten({
        modelURL:
          'https://model-123.api.baseten.co/environments/production/predict',
      });

      expect(() => {
        provider.embeddingModel();
      }).toThrow(
        'Not supported. You must use a /sync or /sync/v1 endpoint for embeddings.',
      );
    });

    it('should support /sync/v1 endpoints (strips /v1 before passing to Performance Client)', () => {
      const provider = createBaseten({
        modelURL:
          'https://model-123.api.baseten.co/environments/production/sync/v1',
      });

      const model = provider.embeddingModel();

      expect(model).toBeInstanceOf(OpenAICompatibleEmbeddingModel);
      expect(OpenAICompatibleEmbeddingModelMock).toHaveBeenCalledWith(
        'embeddings',
        expect.any(Object),
      );
    });

    it('should support custom modelId for embeddings', () => {
      const provider = createBaseten({
        modelURL:
          'https://model-123.api.baseten.co/environments/production/sync',
      });

      const model = provider.embeddingModel();

      expect(model).toBeInstanceOf(OpenAICompatibleEmbeddingModel);
      expect(OpenAICompatibleEmbeddingModelMock).toHaveBeenCalledWith(
        'embeddings',
        expect.any(Object),
      );
    });
  });

  describe('imageModel', () => {
    it('should throw NoSuchModelError for unsupported image models', () => {
      const provider = createBaseten();

      expect(() => {
        provider.imageModel('test-model');
      }).toThrow(NoSuchModelError);
    });
  });

  describe('URL construction', () => {
    it('should use default baseURL when no modelURL is provided', () => {
      const provider = createBaseten();
      const model = provider.chatModel('test-model');

      const constructorCall =
        OpenAICompatibleChatLanguageModelMock.mock.calls[0];
      const config = constructorCall[1];
      const url = config.url({ path: '/chat/completions' });
      expect(url).toBe('https://inference.baseten.co/v1/chat/completions');
    });

    it('should use custom baseURL when provided', () => {
      const provider = createBaseten({
        baseURL: 'https://custom.baseten.co/v1',
      });
      const model = provider.chatModel('test-model');

      const constructorCall =
        OpenAICompatibleChatLanguageModelMock.mock.calls[0];
      const config = constructorCall[1];
      const url = config.url({ path: '/chat/completions' });
      expect(url).toBe('https://custom.baseten.co/v1/chat/completions');
    });

    it('should use modelURL for custom endpoints', () => {
      const provider = createBaseten({
        modelURL:
          'https://model-123.api.baseten.co/environments/production/sync/v1',
      });
      const model = provider.chatModel();

      const constructorCall =
        OpenAICompatibleChatLanguageModelMock.mock.calls[0];
      const config = constructorCall[1];
      const url = config.url({ path: '/chat/completions' });
      expect(url).toBe(
        'https://model-123.api.baseten.co/environments/production/sync/v1/chat/completions',
      );
    });
  });

  describe('Headers', () => {
    it('should include Authorization header with API key', () => {
      const provider = createBaseten();
      const model = provider.chatModel('test-model');

      const constructorCall =
        OpenAICompatibleChatLanguageModelMock.mock.calls[0];
      const config = constructorCall[1];
      const headers = config.headers();

      expect(headers.authorization).toBe('Bearer mock-api-key');
    });

    it('should include custom headers when provided', () => {
      const provider = createBaseten({
        headers: { 'Custom-Header': 'custom-value' },
      });
      const model = provider.chatModel('test-model');

      const constructorCall =
        OpenAICompatibleChatLanguageModelMock.mock.calls[0];
      const config = constructorCall[1];
      const headers = config.headers();

      expect(headers.authorization).toBe('Bearer mock-api-key');
      expect(headers['custom-header']).toBe('custom-value');
    });

    it('should include user-agent with version', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(new Response('{}', { status: 200 }));

      const provider = createBaseten({ fetch: fetchMock });
      const model = provider.chatModel('test-model');

      const constructorCall =
        OpenAICompatibleChatLanguageModelMock.mock.calls[0];
      const config = constructorCall[1];
      const headers = config.headers();

      await fetchMock('https://example.com/test', {
        method: 'POST',
        headers,
      });

      expect(fetchMock.mock.calls[0][1].headers['user-agent']).toContain(
        'ai-sdk/baseten/0.0.0-test',
      );
    });
  });

  describe('Error handling', () => {
    it('should handle missing modelURL for embeddings gracefully', () => {
      const provider = createBaseten();

      expect(() => {
        provider.embeddingModel();
      }).toThrow(
        'No model URL provided for embeddings. Please set modelURL option for embeddings.',
      );
    });

    it('should handle unsupported image models', () => {
      const provider = createBaseten();

      expect(() => {
        provider.imageModel('unsupported-model');
      }).toThrow(NoSuchModelError);
    });
  });

  describe('Provider interface', () => {
    it('should implement all required provider methods', () => {
      const provider = createBaseten();

      expect(typeof provider).toBe('function');
      expect(typeof provider.chatModel).toBe('function');
      expect(typeof provider.languageModel).toBe('function');
      expect(typeof provider.embeddingModel).toBe('function');
      expect(typeof provider.imageModel).toBe('function');
    });

    it('should allow calling provider as function', () => {
      const provider = createBaseten();

      const model1 = provider();
      expect(model1).toBeInstanceOf(OpenAICompatibleChatLanguageModel);

      const model2 = provider('test-model');
      expect(model2).toBeInstanceOf(OpenAICompatibleChatLanguageModel);
    });
  });
});
