import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createKlingAI } from './klingai-provider';
import { KlingAIVideoModel } from './klingai-video-model';

vi.mock('./klingai-video-model', () => ({
  KlingAIVideoModel: vi.fn(),
}));

vi.mock('./klingai-auth', () => ({
  generateKlingAIAuthToken: vi.fn().mockResolvedValue('mock-jwt-token'),
}));

describe('createKlingAI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('video', () => {
    it('should construct a video model with default configuration', () => {
      const provider = createKlingAI();
      const modelId = 'kling-v2.6-motion-control';

      provider.video(modelId);

      expect(KlingAIVideoModel).toHaveBeenCalledWith(
        modelId,
        expect.objectContaining({
          provider: 'klingai.video',
          baseURL: 'https://api-singapore.klingai.com',
        }),
      );
    });

    it('should respect custom baseURL', () => {
      const customBaseURL = 'https://custom.klingai.example.com';
      const provider = createKlingAI({
        baseURL: customBaseURL,
      });
      const modelId = 'kling-v2.6-motion-control';

      provider.video(modelId);

      expect(KlingAIVideoModel).toHaveBeenCalledWith(
        modelId,
        expect.objectContaining({
          baseURL: customBaseURL,
        }),
      );
    });

    it('should pass custom fetch function', () => {
      const mockFetch = vi.fn();
      const provider = createKlingAI({
        fetch: mockFetch,
      });
      const modelId = 'kling-v2.6-motion-control';

      provider.video(modelId);

      expect(KlingAIVideoModel).toHaveBeenCalledWith(
        modelId,
        expect.objectContaining({
          fetch: mockFetch,
        }),
      );
    });

    it('should pass headers as async function', () => {
      const provider = createKlingAI({
        accessKey: 'test-ak',
        secretKey: 'test-sk',
      });
      const modelId = 'kling-v2.6-motion-control';

      provider.video(modelId);

      expect(KlingAIVideoModel).toHaveBeenCalledWith(
        modelId,
        expect.objectContaining({
          headers: expect.any(Function),
        }),
      );
    });
  });

  describe('videoModel', () => {
    it('should be an alias for video', () => {
      const provider = createKlingAI();
      const modelId = 'kling-v2.6-motion-control';

      provider.videoModel(modelId);

      expect(KlingAIVideoModel).toHaveBeenCalledWith(
        modelId,
        expect.objectContaining({
          provider: 'klingai.video',
        }),
      );
    });
  });

  describe('unsupported model types', () => {
    it('should throw NoSuchModelError for languageModel', () => {
      const provider = createKlingAI();

      expect(() => provider.languageModel('some-model')).toThrow();
    });

    it('should throw NoSuchModelError for embeddingModel', () => {
      const provider = createKlingAI();

      expect(() => provider.embeddingModel('some-model')).toThrow();
    });

    it('should throw NoSuchModelError for imageModel', () => {
      const provider = createKlingAI();

      expect(() => provider.imageModel('some-model')).toThrow();
    });
  });

  describe('specificationVersion', () => {
    it('should have specificationVersion v4', () => {
      const provider = createKlingAI();

      expect(provider.specificationVersion).toBe('v4');
    });
  });
});
