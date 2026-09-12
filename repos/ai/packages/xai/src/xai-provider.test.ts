import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { createXai } from './xai-provider';
import { loadApiKey } from '@ai-sdk/provider-utils';
import { XaiChatLanguageModel } from './xai-chat-language-model';
import { XaiResponsesLanguageModel } from './responses/xai-responses-language-model';
import { XaiImageModel } from './xai-image-model';
import { XaiVideoModel } from './xai-video-model';
import { XaiSpeechModel } from './xai-speech-model';
import { XaiTranscriptionModel } from './xai-transcription-model';

const XaiChatLanguageModelMock = XaiChatLanguageModel as unknown as Mock;
const XaiResponsesLanguageModelMock =
  XaiResponsesLanguageModel as unknown as Mock;
const XaiImageModelMock = XaiImageModel as unknown as Mock;
const XaiVideoModelMock = XaiVideoModel as unknown as Mock;
const XaiSpeechModelMock = XaiSpeechModel as unknown as Mock;
const XaiTranscriptionModelMock = XaiTranscriptionModel as unknown as Mock;

vi.mock('./xai-chat-language-model', () => ({
  XaiChatLanguageModel: vi.fn(),
}));

vi.mock('./responses/xai-responses-language-model', () => ({
  XaiResponsesLanguageModel: vi.fn(),
}));

vi.mock('./xai-image-model', () => ({
  XaiImageModel: vi.fn(),
}));

vi.mock('./xai-video-model', () => ({
  XaiVideoModel: vi.fn(),
}));

vi.mock('./xai-speech-model', () => ({
  XaiSpeechModel: vi.fn(),
}));

vi.mock('./xai-transcription-model', () => ({
  XaiTranscriptionModel: vi.fn(),
}));

vi.mock('@ai-sdk/provider-utils', async () => {
  const actual = await vi.importActual('@ai-sdk/provider-utils');
  return {
    ...actual,
    loadApiKey: vi.fn().mockReturnValue('mock-api-key'),
    withoutTrailingSlash: vi.fn(url => url),
    createJsonErrorResponseHandler: vi.fn().mockReturnValue(() => {}),
    generateId: vi.fn().mockReturnValue('mock-id'),
  };
});

vi.mock('./version', () => ({
  VERSION: '0.0.0-test',
}));

describe('xAIProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createXAI', () => {
    it('should create an XAIProvider instance with default options', () => {
      const provider = createXai();
      const model = provider('model-id');

      const constructorCall = XaiResponsesLanguageModelMock.mock.calls[0];
      const config = constructorCall[1];
      config.headers();

      expect(loadApiKey).toHaveBeenCalledWith({
        apiKey: undefined,
        environmentVariableName: 'XAI_API_KEY',
        description: 'xAI API key',
      });
    });

    it('should create an XAIProvider instance with custom options', () => {
      const options = {
        apiKey: 'custom-key',
        baseURL: 'https://custom.url',
        headers: { 'Custom-Header': 'value' },
      };
      const provider = createXai(options);
      provider('model-id');

      const constructorCall = XaiResponsesLanguageModelMock.mock.calls[0];
      const config = constructorCall[1];
      config.headers();

      expect(loadApiKey).toHaveBeenCalledWith({
        apiKey: 'custom-key',
        environmentVariableName: 'XAI_API_KEY',
        description: 'xAI API key',
      });
    });

    it('should return a responses model when called as a function', () => {
      const provider = createXai();
      const modelId = 'foo-model-id';

      const model = provider(modelId);
      expect(model).toBeInstanceOf(XaiResponsesLanguageModel);
    });
  });

  describe('chatModel', () => {
    it('should construct a chat model with correct configuration', () => {
      const provider = createXai();
      const modelId = 'xai-chat-model';

      const model = provider.chat(modelId);

      expect(model).toBeInstanceOf(XaiChatLanguageModel);
    });

    it('should pass the includeUsage option to the chat model, to make sure usage is reported while streaming', () => {
      const provider = createXai();
      const modelId = 'xai-chat-model';

      const model = provider.chat(modelId);

      expect(model).toBeInstanceOf(XaiChatLanguageModel);

      const constructorCall = XaiChatLanguageModelMock.mock.calls[0];

      expect(constructorCall[0]).toBe(modelId);
      expect(constructorCall[1].provider).toBe('xai.chat');
      expect(constructorCall[1].baseURL).toBe('https://api.x.ai/v1');
    });
  });

  describe('imageModel', () => {
    it('should construct an image model with correct configuration', () => {
      const provider = createXai();
      const modelId = 'grok-imagine-image';

      const model = provider.imageModel(modelId);

      expect(model).toBeInstanceOf(XaiImageModel);

      const constructorCall = XaiImageModelMock.mock.calls[0];
      expect(constructorCall[0]).toBe(modelId);

      const config = constructorCall[1];
      expect(config.provider).toBe('xai.image');
      expect(config.baseURL).toBe('https://api.x.ai/v1');
    });

    it('should use custom baseURL for image model', () => {
      const customBaseURL = 'https://custom.xai.api';
      const provider = createXai({ baseURL: customBaseURL });
      const modelId = 'grok-imagine-image';

      provider.imageModel(modelId);

      const constructorCall = XaiImageModelMock.mock.calls[0];
      const config = constructorCall[1];
      expect(config.baseURL).toBe(customBaseURL);
    });

    it('should pass custom headers to image model', () => {
      const customHeaders = { 'Custom-Header': 'test-value' };
      const provider = createXai({ headers: customHeaders });

      provider.imageModel('grok-imagine-image');

      const constructorCall = XaiImageModelMock.mock.calls[0];
      const config = constructorCall[1];
      const headers = config.headers();

      expect(headers).toMatchObject({
        authorization: 'Bearer mock-api-key',
        'custom-header': 'test-value',
        'user-agent': 'ai-sdk/xai/0.0.0-test',
      });
    });
  });

  describe('videoModel', () => {
    it('should construct a video model with correct configuration', () => {
      const provider = createXai();
      const modelId = 'grok-imagine-video';

      provider.videoModel(modelId);

      expect(XaiVideoModelMock).toHaveBeenCalledOnce();

      const constructorCall = XaiVideoModelMock.mock.calls[0];
      expect(constructorCall[0]).toBe(modelId);

      const config = constructorCall[1];
      expect(config.provider).toBe('xai.video');
      expect(config.baseURL).toBe('https://api.x.ai/v1');
    });

    it('should use custom baseURL for video model', () => {
      const customBaseURL = 'https://custom.xai.api';
      const provider = createXai({ baseURL: customBaseURL });

      provider.videoModel('grok-imagine-video');

      const constructorCall = XaiVideoModelMock.mock.calls[0];
      const config = constructorCall[1];
      expect(config.baseURL).toBe(customBaseURL);
    });

    it('should pass custom headers to video model', () => {
      const customHeaders = { 'Custom-Header': 'test-value' };
      const provider = createXai({ headers: customHeaders });

      provider.videoModel('grok-imagine-video');

      const constructorCall = XaiVideoModelMock.mock.calls[0];
      const config = constructorCall[1];
      const headers = config.headers();

      expect(headers).toMatchObject({
        authorization: 'Bearer mock-api-key',
        'custom-header': 'test-value',
        'user-agent': 'ai-sdk/xai/0.0.0-test',
      });
    });

    it('should create a video model via .video() alias', () => {
      const provider = createXai();
      const modelId = 'grok-imagine-video';

      provider.video(modelId);

      expect(XaiVideoModelMock).toHaveBeenCalledOnce();
      const constructorCall = XaiVideoModelMock.mock.calls[0];
      expect(constructorCall[0]).toBe(modelId);
    });
  });

  describe('speechModel', () => {
    it('should construct a speech model with correct configuration', () => {
      const provider = createXai();

      provider.speechModel();

      expect(XaiSpeechModelMock).toHaveBeenCalledOnce();

      const constructorCall = XaiSpeechModelMock.mock.calls[0];
      expect(constructorCall[0]).toBe('');
      expect(constructorCall[1].provider).toBe('xai.speech');
      expect(constructorCall[1].baseURL).toBe('https://api.x.ai/v1');
    });

    it('should use custom baseURL and headers for speech models', () => {
      const provider = createXai({
        baseURL: 'https://custom.xai.api',
        headers: { 'Custom-Header': 'test-value' },
      });

      provider.speech();

      const constructorCall = XaiSpeechModelMock.mock.calls[0];
      expect(constructorCall[1].baseURL).toBe('https://custom.xai.api');
      expect(constructorCall[1].headers()).toMatchObject({
        authorization: 'Bearer mock-api-key',
        'custom-header': 'test-value',
        'user-agent': 'ai-sdk/xai/0.0.0-test',
      });
    });

    it('should create a speech model via .speech() alias', () => {
      const provider = createXai();

      provider.speech();

      expect(XaiSpeechModelMock).toHaveBeenCalledOnce();
    });
  });

  describe('transcriptionModel', () => {
    it('should construct a transcription model with correct configuration', () => {
      const provider = createXai();

      provider.transcriptionModel();

      expect(XaiTranscriptionModelMock).toHaveBeenCalledOnce();

      const constructorCall = XaiTranscriptionModelMock.mock.calls[0];
      expect(constructorCall[0]).toBe('');
      expect(constructorCall[1].provider).toBe('xai.transcription');
      expect(constructorCall[1].baseURL).toBe('https://api.x.ai/v1');
    });

    it('should use custom baseURL and headers for transcription models', () => {
      const provider = createXai({
        baseURL: 'https://custom.xai.api',
        headers: { 'Custom-Header': 'test-value' },
      });

      provider.transcription();

      const constructorCall = XaiTranscriptionModelMock.mock.calls[0];
      expect(constructorCall[1].baseURL).toBe('https://custom.xai.api');
      expect(constructorCall[1].headers()).toMatchObject({
        authorization: 'Bearer mock-api-key',
        'custom-header': 'test-value',
        'user-agent': 'ai-sdk/xai/0.0.0-test',
      });
    });

    it('should create a transcription model via .transcription() alias', () => {
      const provider = createXai();

      provider.transcription();

      expect(XaiTranscriptionModelMock).toHaveBeenCalledOnce();
    });
  });
});
