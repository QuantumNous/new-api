import { describe, expect, it } from 'vitest';
import { MockImageModelV2 } from '../test/mock-image-model-v2';
import { MockImageModelV3 } from '../test/mock-image-model-v3';
import { MockImageModelV4 } from '../test/mock-image-model-v4';
import { asImageModelV4 } from './as-image-model-v4';

describe('asImageModelV4', () => {
  describe('when an image model v4 is provided', () => {
    it('should return the same v4 model unchanged', () => {
      const originalModel = new MockImageModelV4({
        provider: 'test-provider',
        modelId: 'test-model-id',
      });

      const result = asImageModelV4(originalModel);

      expect(result).toBe(originalModel);
      expect(result.specificationVersion).toBe('v4');
    });

    it('should preserve all v4 model properties', () => {
      const originalModel = new MockImageModelV4({
        provider: 'test-provider-v4',
        modelId: 'test-model-v4',
        maxImagesPerCall: 5,
      });

      const result = asImageModelV4(originalModel);

      expect(result.provider).toBe('test-provider-v4');
      expect(result.modelId).toBe('test-model-v4');
      expect(result.maxImagesPerCall).toBe(5);
    });
  });

  describe('when an image model v3 is provided', () => {
    it('should convert v3 to v4 and change specificationVersion', () => {
      const v3Model = new MockImageModelV3({
        provider: 'test-provider',
        modelId: 'test-model-id',
      });

      const result = asImageModelV4(v3Model);

      expect(result.specificationVersion).toBe('v4');
      expect(result).not.toBe(v3Model);
    });

    it('should preserve provider property', () => {
      const v3Model = new MockImageModelV3({
        provider: 'test-provider-v3',
        modelId: 'test-model-id',
      });

      const result = asImageModelV4(v3Model);

      expect(result.provider).toBe('test-provider-v3');
    });

    it('should preserve modelId property', () => {
      const v3Model = new MockImageModelV3({
        provider: 'test-provider',
        modelId: 'test-model-v3',
      });

      const result = asImageModelV4(v3Model);

      expect(result.modelId).toBe('test-model-v3');
    });

    it('should make doGenerate method callable', async () => {
      const v3Model = new MockImageModelV3({
        provider: 'test-provider',
        modelId: 'test-model-id',
        doGenerate: async () => ({
          images: ['base64image'],
          warnings: [],
          response: {
            timestamp: new Date(),
            modelId: 'test-model',
            headers: undefined,
          },
        }),
      });

      const result = asImageModelV4(v3Model);

      const response = await result.doGenerate({
        prompt: 'a test image',
        files: undefined,
        mask: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {},
      });

      expect(response.images).toHaveLength(1);
    });
  });

  describe('when an image model v2 is provided', () => {
    it('should convert v2 through v3 to v4', () => {
      const v2Model = new MockImageModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
      });

      const result = asImageModelV4(v2Model);

      expect(result.specificationVersion).toBe('v4');
      expect(result.provider).toBe('test-provider');
      expect(result.modelId).toBe('test-model-id');
    });
  });
});
