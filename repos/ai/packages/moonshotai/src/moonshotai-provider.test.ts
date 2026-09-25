import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { loadApiKey } from '@ai-sdk/provider-utils';
import { MoonshotAIChatLanguageModel } from './moonshotai-chat-language-model';
import {
  createMoonshotAI,
  getModelStructuredOutputSupport,
} from './moonshotai-provider';

const MoonshotAIChatLanguageModelMock =
  MoonshotAIChatLanguageModel as unknown as Mock;

vi.mock('./moonshotai-chat-language-model', () => {
  const mockConstructor = vi.fn().mockImplementation(function (
    this: any,
    modelId: string,
    settings: any,
  ) {
    this.provider = 'moonshotai.chat';
    this.modelId = modelId;
    this.settings = settings;
  });
  return {
    MoonshotAIChatLanguageModel: mockConstructor,
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

describe('MoonshotAIProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createMoonshotAI', () => {
    it('should create a MoonshotAIProvider instance with default options', () => {
      const provider = createMoonshotAI();
      const model = provider('model-id');

      const constructorCall = MoonshotAIChatLanguageModelMock.mock.calls[0];
      const config = constructorCall[1];
      config.headers();

      expect(loadApiKey).toHaveBeenCalledWith({
        apiKey: undefined,
        environmentVariableName: 'MOONSHOT_API_KEY',
        description: 'Moonshot API key',
      });
    });

    it('should create a MoonshotAIProvider instance with custom options', () => {
      const options = {
        apiKey: 'custom-key',
        baseURL: 'https://custom.url',
        headers: { 'Custom-Header': 'value' },
      };
      const provider = createMoonshotAI(options);
      const model = provider('model-id');

      const constructorCall = MoonshotAIChatLanguageModelMock.mock.calls[0];
      const config = constructorCall[1];
      config.headers();

      expect(loadApiKey).toHaveBeenCalledWith({
        apiKey: 'custom-key',
        environmentVariableName: 'MOONSHOT_API_KEY',
        description: 'Moonshot API key',
      });
    });

    it('should return a chat model when called as a function', () => {
      const provider = createMoonshotAI();
      const modelId = 'kimi-k2.5';

      const model = provider(modelId);
      expect(model).toBeInstanceOf(MoonshotAIChatLanguageModel);
    });
  });

  describe('chatModel', () => {
    it('should construct a chat model with correct configuration', () => {
      const provider = createMoonshotAI();
      const modelId = 'moonshot-v1-8k';

      const model = provider.chatModel(modelId);

      expect(model).toBeInstanceOf(MoonshotAIChatLanguageModel);
    });

    it('should pass transformRequestBody that converts thinking options', () => {
      const provider = createMoonshotAI();
      provider.chatModel('kimi-k2-thinking');

      const constructorCall = MoonshotAIChatLanguageModelMock.mock.calls[0];
      const config = constructorCall[1];
      const transformRequestBody = config.transformRequestBody;

      const result = transformRequestBody({
        model: 'kimi-k2-thinking',
        messages: [],
        thinking: { type: 'enabled', budgetTokens: 2048 },
        reasoningHistory: 'interleaved',
      });

      expect(result).toEqual({
        model: 'kimi-k2-thinking',
        messages: [],
        thinking: { type: 'enabled', budget_tokens: 2048 },
        reasoning_history: 'interleaved',
      });
    });

    it('should handle thinking without budgetTokens', () => {
      const provider = createMoonshotAI();
      provider.chatModel('kimi-k2-thinking');

      const constructorCall = MoonshotAIChatLanguageModelMock.mock.calls[0];
      const config = constructorCall[1];
      const transformRequestBody = config.transformRequestBody;

      const result = transformRequestBody({
        model: 'kimi-k2-thinking',
        messages: [],
        thinking: { type: 'enabled' },
      });

      expect(result).toEqual({
        model: 'kimi-k2-thinking',
        messages: [],
        thinking: { type: 'enabled' },
      });
    });

    it('should handle request without thinking options', () => {
      const provider = createMoonshotAI();
      provider.chatModel('kimi-k2.5');

      const constructorCall = MoonshotAIChatLanguageModelMock.mock.calls[0];
      const config = constructorCall[1];
      const transformRequestBody = config.transformRequestBody;

      const result = transformRequestBody({
        model: 'kimi-k2.5',
        messages: [],
      });

      expect(result).toEqual({
        model: 'kimi-k2.5',
        messages: [],
      });
    });
  });

  describe('languageModel', () => {
    it('should construct a language model with correct configuration', () => {
      const provider = createMoonshotAI();
      const modelId = 'moonshot-v1-32k';

      const model = provider.languageModel(modelId);

      expect(model).toBeInstanceOf(MoonshotAIChatLanguageModel);
    });
  });
});

describe('getMoonshotAILanguageModelCapabilities', () => {
  it.each([
    ['kimi-k2.5', true],
    ['kimi-k2.6', true],
    ['kimi-k2.7-code', true],
    ['kimi-k3', true],
    ['moonshot-v1-8k', false],
    ['moonshot-v1-32k', false],
    ['moonshot-v1-128k', false],
    ['custom-model-id', false],
  ])(
    'supportsStructuredOutputs for %s is %s',
    (modelId, expectedSupportsStructuredOutputs) => {
      expect(getModelStructuredOutputSupport(modelId)).toBe(
        expectedSupportsStructuredOutputs,
      );
    },
  );
});
