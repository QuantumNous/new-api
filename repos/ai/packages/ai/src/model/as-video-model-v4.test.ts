import { describe, expect, it } from 'vitest';
import { MockVideoModelV3 } from '../test/mock-video-model-v3';
import { MockVideoModelV4 } from '../test/mock-video-model-v4';
import { asVideoModelV4 } from './as-video-model-v4';

describe('asVideoModelV4', () => {
  describe('when a video model v4 is provided', () => {
    it('should return the same v4 model unchanged', () => {
      const originalModel = new MockVideoModelV4({
        provider: 'test-provider',
        modelId: 'test-model-id',
      });

      const result = asVideoModelV4(originalModel);

      expect(result).toBe(originalModel);
      expect(result.specificationVersion).toBe('v4');
    });

    it('should preserve all v4 model properties', () => {
      const originalModel = new MockVideoModelV4({
        provider: 'test-provider-v4',
        modelId: 'test-model-v4',
      });

      const result = asVideoModelV4(originalModel);

      expect(result.provider).toBe('test-provider-v4');
      expect(result.modelId).toBe('test-model-v4');
    });
  });

  describe('when a video model v3 is provided', () => {
    it('should convert v3 to v4 and change specificationVersion', () => {
      const v3Model = new MockVideoModelV3({
        provider: 'test-provider',
        modelId: 'test-model-id',
      });

      const result = asVideoModelV4(v3Model);

      expect(result.specificationVersion).toBe('v4');
      expect(result).not.toBe(v3Model);
    });

    it('should preserve provider property', () => {
      const v3Model = new MockVideoModelV3({
        provider: 'test-provider-v3',
        modelId: 'test-model-id',
      });

      const result = asVideoModelV4(v3Model);

      expect(result.provider).toBe('test-provider-v3');
    });

    it('should preserve modelId property', () => {
      const v3Model = new MockVideoModelV3({
        provider: 'test-provider',
        modelId: 'test-model-v3',
      });

      const result = asVideoModelV4(v3Model);

      expect(result.modelId).toBe('test-model-v3');
    });

    it('should make doGenerate method callable', async () => {
      const v3Model = new MockVideoModelV3({
        provider: 'test-provider',
        modelId: 'test-model-id',
        doGenerate: async () => ({
          videos: [
            { type: 'base64' as const, data: 'abc', mediaType: 'video/mp4' },
          ],
          warnings: [],
          response: {
            timestamp: new Date(),
            modelId: 'test-model',
            headers: undefined,
          },
        }),
      });

      const result = asVideoModelV4(v3Model);

      const response = await result.doGenerate({
        prompt: 'a test video',
        n: 1,
        aspectRatio: undefined,
        resolution: undefined,
        duration: undefined,
        fps: undefined,
        seed: undefined,
        generateAudio: undefined,
        image: undefined,
        frameImages: undefined,
        inputReferences: undefined,
        providerOptions: {},
      });

      expect(response.videos).toHaveLength(1);
    });
  });
});
