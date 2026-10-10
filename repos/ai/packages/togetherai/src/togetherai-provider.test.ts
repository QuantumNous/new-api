import {
  OpenAICompatibleChatLanguageModel,
  OpenAICompatibleCompletionLanguageModel,
  OpenAICompatibleEmbeddingModel,
} from '@ai-sdk/openai-compatible';
import type {
  EmbeddingModelV4,
  LanguageModelV4,
  RerankingModelV4,
} from '@ai-sdk/provider';
import { loadApiKey } from '@ai-sdk/provider-utils';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest';
import { TogetherAIRerankingModel } from './reranking/togetherai-reranking-model';
import { TogetherAIImageModel } from './togetherai-image-model';
import { createTogetherAI } from './togetherai-provider';

// Add type assertion for the mocked class
const OpenAICompatibleChatLanguageModelMock =
  OpenAICompatibleChatLanguageModel as unknown as Mock;

vi.mock('@ai-sdk/openai-compatible', () => ({
  OpenAICompatibleChatLanguageModel: vi.fn(),
  OpenAICompatibleCompletionLanguageModel: vi.fn(),
  OpenAICompatibleEmbeddingModel: vi.fn(),
}));

vi.mock('@ai-sdk/provider-utils', async () => {
  const actual = await vi.importActual('@ai-sdk/provider-utils');
  return {
    ...actual,
    loadApiKey: vi.fn().mockReturnValue('mock-api-key'),
    withoutTrailingSlash: vi.fn(url => url),
  };
});

vi.mock('./togetherai-image-model', () => ({
  TogetherAIImageModel: vi.fn(),
}));

vi.mock('./reranking/togetherai-reranking-model', () => ({
  TogetherAIRerankingModel: vi.fn(),
}));

describe('TogetherAIProvider', () => {
  const originalEnv = { ...process.env };

  let mockLanguageModel: LanguageModelV4;
  let mockEmbeddingModel: EmbeddingModelV4;
  let mockRerankingModel: RerankingModelV4;

  beforeEach(() => {
    // Mock implementations of models
    mockLanguageModel = {
      // Add any required methods for LanguageModelV4
    } as LanguageModelV4;
    mockEmbeddingModel = {
      // Add any required methods for EmbeddingModelV4
    } as EmbeddingModelV4;
    mockRerankingModel = {
      // Add any required methods for RerankingModelV4
    } as RerankingModelV4;

    vi.clearAllMocks();
    delete process.env.TOGETHER_API_KEY;
    delete process.env.TOGETHER_AI_API_KEY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('createTogetherAI', () => {
    it('should create a TogetherAIProvider instance with default options', () => {
      const provider = createTogetherAI();
      const model = provider('model-id');

      const constructorCall =
        OpenAICompatibleChatLanguageModelMock.mock.calls[0];
      const config = constructorCall[1];
      config.headers();

      expect(loadApiKey).toHaveBeenCalledWith({
        apiKey: undefined,
        environmentVariableName: 'TOGETHER_API_KEY',
        description: 'TogetherAI',
      });
    });

    it('should create a TogetherAIProvider instance with custom options', () => {
      const options = {
        apiKey: 'custom-key',
        baseURL: 'https://custom.url',
        headers: { 'Custom-Header': 'value' },
      };
      const provider = createTogetherAI(options);
      const model = provider('model-id');

      const constructorCall =
        OpenAICompatibleChatLanguageModelMock.mock.calls[0];
      const config = constructorCall[1];
      config.headers();

      expect(loadApiKey).toHaveBeenCalledWith({
        apiKey: 'custom-key',
        environmentVariableName: 'TOGETHER_API_KEY',
        description: 'TogetherAI',
      });
    });

    it('should fall back to TOGETHER_AI_API_KEY with deprecation warning', () => {
      process.env.TOGETHER_AI_API_KEY = 'old-key';
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const provider = createTogetherAI();
      const model = provider('model-id');

      const constructorCall =
        OpenAICompatibleChatLanguageModelMock.mock.calls[0];
      const config = constructorCall[1];
      config.headers();

      expect(loadApiKey).toHaveBeenCalledWith({
        apiKey: 'old-key',
        environmentVariableName: 'TOGETHER_API_KEY',
        description: 'TogetherAI',
      });
      expect(warnSpy).toHaveBeenCalledWith(
        'TOGETHER_AI_API_KEY is deprecated and will be removed in a future release. Please use TOGETHER_API_KEY instead.',
      );
    });

    it('should prefer TOGETHER_API_KEY over TOGETHER_AI_API_KEY', () => {
      process.env.TOGETHER_API_KEY = 'new-key';
      process.env.TOGETHER_AI_API_KEY = 'old-key';
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const provider = createTogetherAI();
      const model = provider('model-id');

      const constructorCall =
        OpenAICompatibleChatLanguageModelMock.mock.calls[0];
      const config = constructorCall[1];
      config.headers();

      expect(loadApiKey).toHaveBeenCalledWith({
        apiKey: undefined,
        environmentVariableName: 'TOGETHER_API_KEY',
        description: 'TogetherAI',
      });
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('should prefer explicit apiKey over TOGETHER_AI_API_KEY', () => {
      process.env.TOGETHER_AI_API_KEY = 'old-key';
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const provider = createTogetherAI({ apiKey: 'explicit-key' });
      const model = provider('model-id');

      const constructorCall =
        OpenAICompatibleChatLanguageModelMock.mock.calls[0];
      const config = constructorCall[1];
      config.headers();

      expect(loadApiKey).toHaveBeenCalledWith({
        apiKey: 'explicit-key',
        environmentVariableName: 'TOGETHER_API_KEY',
        description: 'TogetherAI',
      });
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('should return a chat model when called as a function', () => {
      const provider = createTogetherAI();
      const modelId = 'foo-model-id';

      const model = provider(modelId);
      expect(model).toBeInstanceOf(OpenAICompatibleChatLanguageModel);
    });
  });

  describe('chatModel', () => {
    it('should construct a chat model with correct configuration', () => {
      const provider = createTogetherAI();
      const modelId = 'together-chat-model';

      const model = provider.chatModel(modelId);

      expect(model).toBeInstanceOf(OpenAICompatibleChatLanguageModel);
    });
  });

  describe('completionModel', () => {
    it('should construct a completion model with correct configuration', () => {
      const provider = createTogetherAI();
      const modelId = 'together-completion-model';

      const model = provider.completionModel(modelId);

      expect(model).toBeInstanceOf(OpenAICompatibleCompletionLanguageModel);
    });
  });

  describe('embeddingModel', () => {
    it('should construct a text embedding model with correct configuration', () => {
      const provider = createTogetherAI();
      const modelId = 'together-embedding-model';

      const model = provider.embeddingModel(modelId);

      expect(model).toBeInstanceOf(OpenAICompatibleEmbeddingModel);
    });
  });

  describe('image', () => {
    it('should construct an image model with correct configuration', () => {
      const provider = createTogetherAI();
      const modelId = 'stabilityai/stable-diffusion-xl';

      const model = provider.image(modelId);

      expect(TogetherAIImageModel).toHaveBeenCalledWith(
        modelId,
        expect.objectContaining({
          provider: 'togetherai.image',
          baseURL: 'https://api.together.xyz/v1/',
        }),
      );
      expect(model).toBeInstanceOf(TogetherAIImageModel);
    });

    it('should pass custom baseURL to image model', () => {
      const provider = createTogetherAI({
        baseURL: 'https://custom.url/',
      });
      const modelId = 'stabilityai/stable-diffusion-xl';

      provider.image(modelId);

      expect(TogetherAIImageModel).toHaveBeenCalledWith(
        modelId,
        expect.objectContaining({
          baseURL: 'https://custom.url/',
        }),
      );
    });
  });

  describe('rerankingModel', () => {
    it('should construct a reranking model with correct configuration', () => {
      const provider = createTogetherAI();
      const modelId = 'Salesforce/Llama-Rank-v1';
      0;
      const model = provider.rerankingModel(modelId);

      expect(TogetherAIRerankingModel).toHaveBeenCalledWith(
        modelId,
        expect.objectContaining({
          baseURL: 'https://api.together.xyz/v1/',
        }),
      );
      expect(model).toBeInstanceOf(TogetherAIRerankingModel);
    });
  });
});
