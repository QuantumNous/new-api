import type { ImageModelV2 } from '@ai-sdk/provider';
import { asImageModelV3 } from './as-image-model-v3';
import { MockImageModelV2 } from '../test/mock-image-model-v2';
import { MockImageModelV3 } from '../test/mock-image-model-v3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as logWarningsModule from '../logger/log-warnings';

describe('asImageModelV3', () => {
  let logWarningSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logWarningSpy = vi
      .spyOn(logWarningsModule, 'logWarnings')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    logWarningSpy.mockRestore();
  });

  describe('when an image model v3 is provided', () => {
    it('should return the same v3 model unchanged', () => {
      const originalModel = new MockImageModelV3({
        provider: 'test-provider',
        modelId: 'test-model-id',
      });

      const result = asImageModelV3(originalModel);

      expect(result).toBe(originalModel);
      expect(result.specificationVersion).toBe('v3');
    });

    it('should not log any warning', () => {
      const originalModel = new MockImageModelV3({
        provider: 'test-provider',
        modelId: 'test-model-id',
      });

      asImageModelV3(originalModel);

      expect(logWarningSpy).not.toHaveBeenCalled();
    });

    it('should preserve all v3 model properties', () => {
      const originalModel = new MockImageModelV3({
        provider: 'test-provider-v3',
        modelId: 'test-model-v3',
        maxImagesPerCall: 5,
      });

      const result = asImageModelV3(originalModel);

      expect(result.provider).toBe('test-provider-v3');
      expect(result.modelId).toBe('test-model-v3');
      expect(result.maxImagesPerCall).toBe(5);
      expect(result.specificationVersion).toBe('v3');
    });
  });

  describe('when an image model v2 is provided', () => {
    it('should convert v2 to v3 and change specificationVersion', () => {
      const v2Model = new MockImageModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
      });

      const result = asImageModelV3(v2Model);

      expect(result.specificationVersion).toBe('v3');
      expect(result).not.toBe(v2Model);
    });

    it('should log a compatibility warning', () => {
      const v2Model = new MockImageModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
      });

      asImageModelV3(v2Model);

      expect(logWarningSpy).toHaveBeenCalledWith({
        warnings: [
          {
            type: 'compatibility',
            feature: 'specificationVersion',
            details: expect.stringContaining(
              'Using v2 specification compatibility',
            ),
          },
        ],
        provider: 'test-provider',
        model: 'test-model-id',
      });
    });

    it('should preserve provider property', () => {
      const v2Model = new MockImageModelV2({
        provider: 'test-provider-v2',
        modelId: 'test-model-id',
      });

      const result = asImageModelV3(v2Model);

      expect(result.provider).toBe('test-provider-v2');
    });

    it('should preserve modelId property', () => {
      const v2Model = new MockImageModelV2({
        provider: 'test-provider',
        modelId: 'test-model-v2',
      });

      const result = asImageModelV3(v2Model);

      expect(result.modelId).toBe('test-model-v2');
    });

    it('should preserve maxImagesPerCall property', () => {
      const v2Model = new MockImageModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
        maxImagesPerCall: 3,
      });

      const result = asImageModelV3(v2Model);

      expect(result.maxImagesPerCall).toBe(3);
    });

    it('should preserve maxImagesPerCall as function', () => {
      const maxImagesPerCallFn = ({ modelId }: { modelId: string }) => 5;
      const v2Model = new MockImageModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
        maxImagesPerCall: maxImagesPerCallFn,
      });

      const result = asImageModelV3(v2Model);

      expect(result.maxImagesPerCall).toBe(maxImagesPerCallFn);
    });

    it('should make doGenerate method callable with base64 images', async () => {
      const v2Model = new MockImageModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
        doGenerate: async () => ({
          images: ['base64encodedimage'],
          warnings: [],
          response: {
            timestamp: new Date(),
            modelId: 'test-model',
            headers: undefined,
          },
        }),
      });

      const result = asImageModelV3(v2Model);

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
      expect(response.images[0]).toBe('base64encodedimage');
    });

    it('should make doGenerate method callable with binary images', async () => {
      const binaryData = new Uint8Array([1, 2, 3, 4]);
      const v2Model = new MockImageModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
        doGenerate: async () => ({
          images: [binaryData],
          warnings: [],
          response: {
            timestamp: new Date(),
            modelId: 'test-model',
            headers: undefined,
          },
        }),
      });

      const result = asImageModelV3(v2Model);

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
      expect(response.images[0]).toBe(binaryData);
    });

    it('should handle doGenerate with multiple images', async () => {
      const v2Model = new MockImageModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
        doGenerate: async () => ({
          images: ['image1', 'image2', 'image3'],
          warnings: [],
          response: {
            timestamp: new Date(),
            modelId: 'test-model',
            headers: undefined,
          },
        }),
      });

      const result = asImageModelV3(v2Model);

      const response = await result.doGenerate({
        prompt: 'multiple test images',
        files: undefined,
        mask: undefined,
        n: 3,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {},
      });

      expect(response.images).toHaveLength(3);
      expect(response.images).toEqual(['image1', 'image2', 'image3']);
    });

    it('should handle doGenerate with warnings', async () => {
      const v2Model = new MockImageModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
        doGenerate: async () => ({
          images: ['image1'],
          warnings: [
            {
              type: 'unsupported-setting',
              setting: 'seed',
              details: 'Seed setting not supported',
            },
          ],
          response: {
            timestamp: new Date(),
            modelId: 'test-model',
            headers: undefined,
          },
        }),
      });

      const result = asImageModelV3(v2Model);

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

      expect(response.warnings).toHaveLength(1);
      expect(response.warnings[0].type).toBe('unsupported-setting');
    });

    it('should handle doGenerate with provider metadata', async () => {
      const v2Model = new MockImageModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
        doGenerate: async () => ({
          images: ['image1'],
          warnings: [],
          providerMetadata: {
            openai: {
              images: [{ revisedPrompt: 'Revised prompt' }],
            },
          },
          response: {
            timestamp: new Date(),
            modelId: 'test-model',
            headers: undefined,
          },
        }),
      });

      const result = asImageModelV3(v2Model);

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

      expect(response.providerMetadata?.openai).toBeDefined();
      expect(response.providerMetadata?.openai.images).toHaveLength(1);
    });

    it('should handle doGenerate with response headers', async () => {
      const v2Model = new MockImageModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
        doGenerate: async () => ({
          images: ['image1'],
          warnings: [],
          response: {
            timestamp: new Date(),
            modelId: 'test-model',
            headers: { 'x-custom': 'header-value' },
          },
        }),
      });

      const result = asImageModelV3(v2Model);

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

      expect(response.response.headers).toEqual({ 'x-custom': 'header-value' });
    });

    it('should handle doGenerate with response metadata', async () => {
      const timestamp = new Date();
      const v2Model = new MockImageModelV2({
        provider: 'test-provider',
        modelId: 'test-model-id',
        doGenerate: async () => ({
          images: ['image1'],
          warnings: [],
          response: {
            timestamp,
            modelId: 'actual-model-id',
            headers: undefined,
          },
        }),
      });

      const result = asImageModelV3(v2Model);

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

      expect(response.response.timestamp).toBe(timestamp);
      expect(response.response.modelId).toBe('actual-model-id');
    });

    it('should preserve prototype methods when using class instances', async () => {
      class TestImageModelV2 implements ImageModelV2 {
        readonly specificationVersion = 'v2' as const;
        readonly provider = 'test-provider';
        readonly modelId = 'test-model-id';
        readonly maxImagesPerCall = 1;

        customMethod() {
          return 'custom-value';
        }

        async doGenerate() {
          return {
            images: ['image1'],
            warnings: [],
            response: {
              timestamp: new Date(),
              modelId: 'test-model',
              headers: undefined,
            },
          };
        }
      }

      const v2Model = new TestImageModelV2();
      const result = asImageModelV3(v2Model) as any;

      expect(result.customMethod()).toBe('custom-value');
      expect(result.specificationVersion).toBe('v3');
    });
  });
});
