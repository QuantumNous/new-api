import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createLuma } from './luma-provider';
import { LumaImageModel } from './luma-image-model';

vi.mock('./luma-image-model', () => ({
  LumaImageModel: vi.fn(),
}));

describe('createLuma', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('image', () => {
    it('should construct an image model with default configuration', () => {
      const provider = createLuma();
      const modelId = 'luma-v1';

      const model = provider.image(modelId);

      expect(model).toBeInstanceOf(LumaImageModel);
      expect(LumaImageModel).toHaveBeenCalledWith(
        modelId,
        expect.objectContaining({
          provider: 'luma.image',
          baseURL: 'https://api.lumalabs.ai',
        }),
      );
    });

    it('should respect custom configuration options', () => {
      const customBaseURL = 'https://custom-api.lumalabs.ai';
      const customHeaders = { 'X-Custom-Header': 'value' };
      const mockFetch = vi.fn();

      const provider = createLuma({
        apiKey: 'custom-api-key',
        baseURL: customBaseURL,
        headers: customHeaders,
        fetch: mockFetch,
      });
      const modelId = 'luma-v1';

      provider.image(modelId);

      expect(LumaImageModel).toHaveBeenCalledWith(
        modelId,
        expect.objectContaining({
          baseURL: customBaseURL,
          headers: expect.any(Function),
          fetch: mockFetch,
          provider: 'luma.image',
        }),
      );
    });
  });
});
