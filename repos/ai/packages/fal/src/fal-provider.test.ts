import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createFal } from './fal-provider';
import { FalImageModel } from './fal-image-model';
import { FalVideoModel } from './fal-video-model';

vi.mock('./fal-image-model', () => ({
  FalImageModel: vi.fn(),
}));

vi.mock('./fal-video-model', () => ({
  FalVideoModel: vi.fn(),
}));

describe('createFal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('image', () => {
    it('should construct an image model with default configuration', () => {
      const provider = createFal();
      const modelId = 'fal-ai/flux/dev';

      const model = provider.image(modelId);

      expect(model).toBeInstanceOf(FalImageModel);
      expect(FalImageModel).toHaveBeenCalledWith(
        modelId,
        expect.objectContaining({
          provider: 'fal.image',
          baseURL: 'https://fal.run',
        }),
      );
    });

    it('should respect custom configuration options', () => {
      const customBaseURL = 'https://custom.fal.run';
      const customHeaders = { 'X-Custom-Header': 'value' };
      const mockFetch = vi.fn();

      const provider = createFal({
        apiKey: 'custom-api-key',
        baseURL: customBaseURL,
        headers: customHeaders,
        fetch: mockFetch,
      });
      const modelId = 'fal-ai/flux/dev';

      provider.image(modelId);

      expect(FalImageModel).toHaveBeenCalledWith(
        modelId,
        expect.objectContaining({
          baseURL: customBaseURL,
          headers: expect.any(Function),
          fetch: mockFetch,
          provider: 'fal.image',
        }),
      );
    });
  });

  describe('video', () => {
    it('should construct a video model with default configuration', () => {
      const provider = createFal();
      const modelId = 'luma-dream-machine';

      const model = provider.video(modelId);

      expect(model).toBeInstanceOf(FalVideoModel);
      expect(FalVideoModel).toHaveBeenCalledWith(
        modelId,
        expect.objectContaining({
          provider: 'fal.video',
        }),
      );
    });

    it('should respect custom configuration options', () => {
      const customHeaders = { 'X-Custom-Header': 'value' };
      const mockFetch = vi.fn();

      const provider = createFal({
        apiKey: 'custom-api-key',
        headers: customHeaders,
        fetch: mockFetch,
      });
      const modelId = 'luma-ray-2';

      provider.video(modelId);

      expect(FalVideoModel).toHaveBeenCalledWith(
        modelId,
        expect.objectContaining({
          headers: expect.any(Function),
          fetch: mockFetch,
          provider: 'fal.video',
        }),
      );
    });

    it('should support various video model IDs', () => {
      const provider = createFal();
      const modelIds = [
        'luma-dream-machine',
        'luma-ray-2',
        'luma-ray-2-flash',
        'minimax-video',
        'minimax-video-01',
        'hunyuan-video',
        'custom-model',
      ];

      for (const modelId of modelIds) {
        vi.clearAllMocks();
        provider.video(modelId);
        expect(FalVideoModel).toHaveBeenCalledWith(
          modelId,
          expect.objectContaining({
            provider: 'fal.video',
          }),
        );
      }
    });
  });
});
