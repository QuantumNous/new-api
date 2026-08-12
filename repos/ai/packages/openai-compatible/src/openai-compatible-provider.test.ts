import { createOpenAICompatible } from './openai-compatible-provider';
import { OpenAICompatibleChatLanguageModel } from './chat/openai-compatible-chat-language-model';
import { OpenAICompatibleCompletionLanguageModel } from './completion/openai-compatible-completion-language-model';
import { OpenAICompatibleEmbeddingModel } from './embedding/openai-compatible-embedding-model';
import { OpenAICompatibleImageModel } from './image/openai-compatible-image-model';
import { vi, describe, beforeEach, it, expect } from 'vitest';

// Mock version
vi.mock('./version', () => ({
  VERSION: '0.0.0-test',
}));

const OpenAICompatibleChatLanguageModelMock = vi.mocked(
  OpenAICompatibleChatLanguageModel,
);
const OpenAICompatibleCompletionLanguageModelMock = vi.mocked(
  OpenAICompatibleCompletionLanguageModel,
);
const OpenAICompatibleEmbeddingModelMock = vi.mocked(
  OpenAICompatibleEmbeddingModel,
);

const OpenAICompatibleImageModelMock = vi.mocked(OpenAICompatibleImageModel);

vi.mock('./chat/openai-compatible-chat-language-model', () => ({
  OpenAICompatibleChatLanguageModel: vi.fn(),
}));

vi.mock('./image/openai-compatible-image-model', () => ({
  OpenAICompatibleImageModel: vi.fn(),
}));

vi.mock('./completion/openai-compatible-completion-language-model', () => ({
  OpenAICompatibleCompletionLanguageModel: vi.fn(),
}));

vi.mock('./embedding/openai-compatible-embedding-model', () => ({
  OpenAICompatibleEmbeddingModel: vi.fn(),
}));

describe('OpenAICompatibleProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createOpenAICompatible', () => {
    it('should create provider with correct configuration', () => {
      const options = {
        baseURL: 'https://api.example.com',
        name: 'test-provider',
        apiKey: 'test-api-key',
        headers: { 'custom-header': 'value' },
        queryParams: { 'Custom-Param': 'value' },
      };

      const provider = createOpenAICompatible(options);
      provider('model-id');

      const constructorCall =
        OpenAICompatibleChatLanguageModelMock.mock.calls[0];
      const config = constructorCall[1];
      const headers = config.headers!();

      expect(headers).toEqual({
        authorization: 'Bearer test-api-key',
        'custom-header': 'value',
        'user-agent': 'ai-sdk/openai-compatible/0.0.0-test',
      });
      expect(config.provider).toBe('test-provider.chat');
      expect(config.url({ modelId: 'model-id', path: '/v1/chat' })).toBe(
        'https://api.example.com/v1/chat?Custom-Param=value',
      );
    });

    it('should create headers without authorization when no apiKey provided', () => {
      const options = {
        baseURL: 'https://api.example.com',
        name: 'test-provider',
        headers: { 'custom-header': 'value' },
      };

      const provider = createOpenAICompatible(options);
      provider('model-id');

      const constructorCall =
        OpenAICompatibleChatLanguageModelMock.mock.calls[0];
      const config = constructorCall[1];
      const headers = config.headers!();

      expect(headers).toEqual({
        'custom-header': 'value',
        'user-agent': 'ai-sdk/openai-compatible/0.0.0-test',
      });
    });
  });

  describe('model creation methods', () => {
    const defaultOptions = {
      baseURL: 'https://api.example.com',
      name: 'test-provider',
      apiKey: 'test-api-key',
      headers: { 'custom-header': 'value' },
      queryParams: { 'Custom-Param': 'value' },
    };

    it('should create chat model with correct configuration', () => {
      const provider = createOpenAICompatible(defaultOptions);

      provider.chatModel('chat-model');

      const constructorCall =
        OpenAICompatibleChatLanguageModelMock.mock.calls[0];
      const config = constructorCall[1];
      const headers = config.headers!();

      expect(headers).toEqual({
        authorization: 'Bearer test-api-key',
        'custom-header': 'value',
        'user-agent': 'ai-sdk/openai-compatible/0.0.0-test',
      });
      expect(config.provider).toBe('test-provider.chat');
      expect(config.url({ modelId: 'model-id', path: '/v1/chat' })).toBe(
        'https://api.example.com/v1/chat?Custom-Param=value',
      );
    });

    it('should create completion model with correct configuration', () => {
      const provider = createOpenAICompatible(defaultOptions);

      provider.completionModel('completion-model');

      const constructorCall =
        OpenAICompatibleCompletionLanguageModelMock.mock.calls[0];
      const config = constructorCall[1];
      const headers = config.headers!();

      expect(headers).toEqual({
        authorization: 'Bearer test-api-key',
        'custom-header': 'value',
        'user-agent': 'ai-sdk/openai-compatible/0.0.0-test',
      });
      expect(config.provider).toBe('test-provider.completion');
      expect(
        config.url({ modelId: 'completion-model', path: '/v1/completions' }),
      ).toBe('https://api.example.com/v1/completions?Custom-Param=value');
    });

    it('should create embedding model with correct configuration', () => {
      const provider = createOpenAICompatible(defaultOptions);

      provider.embeddingModel('embedding-model');

      const constructorCall = OpenAICompatibleEmbeddingModelMock.mock.calls[0];
      const config = constructorCall[1];
      const headers = config.headers!();

      expect(headers).toEqual({
        authorization: 'Bearer test-api-key',
        'custom-header': 'value',
        'user-agent': 'ai-sdk/openai-compatible/0.0.0-test',
      });
      expect(config.provider).toBe('test-provider.embedding');
      expect(
        config.url({ modelId: 'embedding-model', path: '/v1/embeddings' }),
      ).toBe('https://api.example.com/v1/embeddings?Custom-Param=value');
    });

    it('should use languageModel as default when called as function', () => {
      const provider = createOpenAICompatible(defaultOptions);

      provider('model-id');

      expect(OpenAICompatibleChatLanguageModel).toHaveBeenCalledWith(
        'model-id',
        expect.objectContaining({
          provider: 'test-provider.chat',
        }),
      );
    });

    it('should create URL without query parameters when queryParams is not specified', () => {
      const options = {
        baseURL: 'https://api.example.com',
        name: 'test-provider',
        apiKey: 'test-api-key',
      };

      const provider = createOpenAICompatible(options);
      provider('model-id');

      const constructorCall =
        OpenAICompatibleChatLanguageModelMock.mock.calls[0];
      const config = constructorCall[1];

      expect(config.url({ modelId: 'model-id', path: '/v1/chat' })).toBe(
        'https://api.example.com/v1/chat',
      );
    });
  });

  describe('includeUsage setting', () => {
    it('should pass includeUsage: true to all model types when specified in provider settings', () => {
      const options = {
        baseURL: 'https://api.example.com',
        name: 'test-provider',
        includeUsage: true,
      };
      const provider = createOpenAICompatible(options);

      provider.chatModel('chat-model');
      expect(
        OpenAICompatibleChatLanguageModelMock.mock.calls[0][1].includeUsage,
      ).toBe(true);

      provider.completionModel('completion-model');
      expect(
        OpenAICompatibleCompletionLanguageModelMock.mock.calls[0][1]
          .includeUsage,
      ).toBe(true);

      provider('model-id');
      expect(
        OpenAICompatibleChatLanguageModelMock.mock.calls[1][1].includeUsage,
      ).toBe(true);
    });

    it('should pass includeUsage: false to all model types when specified in provider settings', () => {
      const options = {
        baseURL: 'https://api.example.com',
        name: 'test-provider',
        includeUsage: false,
      };
      const provider = createOpenAICompatible(options);

      provider.chatModel('chat-model');
      expect(
        OpenAICompatibleChatLanguageModelMock.mock.calls[0][1].includeUsage,
      ).toBe(false);

      provider.completionModel('completion-model');
      expect(
        OpenAICompatibleCompletionLanguageModelMock.mock.calls[0][1]
          .includeUsage,
      ).toBe(false);

      provider('model-id');
      expect(
        OpenAICompatibleChatLanguageModelMock.mock.calls[1][1].includeUsage,
      ).toBe(false);
    });

    it('should pass includeUsage: undefined to all model types when not specified in provider settings', () => {
      const options = {
        baseURL: 'https://api.example.com',
        name: 'test-provider',
      };
      const provider = createOpenAICompatible(options);

      provider.chatModel('chat-model');
      expect(
        OpenAICompatibleChatLanguageModelMock.mock.calls[0][1].includeUsage,
      ).toBeUndefined();

      provider.completionModel('completion-model');
      expect(
        OpenAICompatibleCompletionLanguageModelMock.mock.calls[0][1]
          .includeUsage,
      ).toBeUndefined();

      provider('model-id');
      expect(
        OpenAICompatibleChatLanguageModelMock.mock.calls[1][1].includeUsage,
      ).toBeUndefined();
    });
  });

  describe('supportsStructuredOutputs setting', () => {
    it('should pass supportsStructuredOutputs to .chatModel() and .languageModel() only', () => {
      const options = {
        baseURL: 'https://api.example.com',
        name: 'test-provider',
        supportsStructuredOutputs: true,
      };
      const provider = createOpenAICompatible(options);

      provider('model-id');
      expect(
        OpenAICompatibleChatLanguageModelMock.mock.calls[0][1]
          .supportsStructuredOutputs,
      ).toBe(true);

      provider.chatModel('chat-model');
      expect(
        OpenAICompatibleChatLanguageModelMock.mock.calls[1][1]
          .supportsStructuredOutputs,
      ).toBe(true);

      provider.languageModel('completion-model');
      expect(
        OpenAICompatibleChatLanguageModelMock.mock.calls[2][1]
          .supportsStructuredOutputs,
      ).toBe(true);

      provider.completionModel('completion-model');
      const completionModelConfigArg =
        OpenAICompatibleCompletionLanguageModelMock.mock.calls[0][1];
      expect(
        // @ts-expect-error - testing
        completionModelConfigArg.supportsStructuredOutputs,
      ).toBe(undefined);

      provider.embeddingModel('embedding-model');
      const embeddingModelConfigArg =
        OpenAICompatibleEmbeddingModelMock.mock.calls[0][1];
      expect(
        // @ts-expect-error - testing
        embeddingModelConfigArg.supportsStructuredOutputs,
      ).toBe(undefined);

      provider.imageModel('image-model');
      const imageModelConfigArg =
        OpenAICompatibleImageModelMock.mock.calls[0][1];
      expect(
        // @ts-expect-error - testing
        imageModelConfigArg.supportsStructuredOutputs,
      ).toBe(undefined);
    });
  });

  describe('metadataExtractor setting', () => {
    it('should pass metadataExtractor to chat model', () => {
      const mockExtractor = {
        extractMetadata: async () => undefined,
        createStreamExtractor: () => ({
          processChunk: () => {},
          buildMetadata: () => undefined,
        }),
      };

      const provider = createOpenAICompatible({
        baseURL: 'https://api.example.com',
        name: 'test-provider',
        metadataExtractor: mockExtractor,
      });

      provider.chatModel('chat-model');

      expect(
        OpenAICompatibleChatLanguageModelMock.mock.calls[0][1]
          .metadataExtractor,
      ).toBe(mockExtractor);
    });
  });
});
