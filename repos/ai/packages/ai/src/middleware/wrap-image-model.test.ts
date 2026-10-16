import type {
  ImageModelV4CallOptions,
  ImageModelV4Middleware,
} from '@ai-sdk/provider';
import { wrapImageModel } from '../middleware/wrap-image-model';
import { MockImageModelV4 } from '../test/mock-image-model-v4';
import { describe, it, expect, vi } from 'vitest';

describe('wrapImageModel', () => {
  describe('model property', () => {
    it('should pass through by default', () => {
      const wrappedModel = wrapImageModel({
        model: new MockImageModelV4({
          modelId: 'test-model',
        }),
        middleware: {
          specificationVersion: 'v4',
        },
      });

      expect(wrappedModel.modelId).toBe('test-model');
    });

    it('should use middleware overrideModelId if provided', () => {
      const wrappedModel = wrapImageModel({
        model: new MockImageModelV4({
          modelId: 'test-model',
        }),
        middleware: {
          specificationVersion: 'v4',
          overrideModelId: ({ model }) => 'override-model',
        },
      });

      expect(wrappedModel.modelId).toBe('override-model');
    });

    it('should use modelId parameter if provided', () => {
      const wrappedModel = wrapImageModel({
        model: new MockImageModelV4({
          modelId: 'test-model',
        }),
        middleware: {
          specificationVersion: 'v4',
        },
        modelId: 'override-model',
      });

      expect(wrappedModel.modelId).toBe('override-model');
    });
  });

  describe('provider property', () => {
    it('should pass through by default', () => {
      const wrappedModel = wrapImageModel({
        model: new MockImageModelV4({
          provider: 'test-provider',
        }),
        middleware: {
          specificationVersion: 'v4',
        },
      });

      expect(wrappedModel.provider).toBe('test-provider');
    });

    it('should use middleware overrideProvider if provided', () => {
      const wrappedModel = wrapImageModel({
        model: new MockImageModelV4({
          provider: 'test-provider',
        }),
        middleware: {
          specificationVersion: 'v4',
          overrideProvider: ({ model }) => 'override-provider',
        },
      });

      expect(wrappedModel.provider).toBe('override-provider');
    });

    it('should use providerId parameter if provided', () => {
      const wrappedModel = wrapImageModel({
        model: new MockImageModelV4({
          provider: 'test-provider',
        }),
        middleware: {
          specificationVersion: 'v4',
        },
        providerId: 'override-provider',
      });

      expect(wrappedModel.provider).toBe('override-provider');
    });
  });

  describe('maxImagesPerCall property', () => {
    it('should pass through by default', () => {
      const wrappedModel = wrapImageModel({
        model: new MockImageModelV4({ maxImagesPerCall: 2 }),
        middleware: {
          specificationVersion: 'v4',
        },
      });

      expect(wrappedModel.maxImagesPerCall).toBe(2);
    });

    it('should use middleware overrideMaxImagesPerCall if provided', () => {
      const wrappedModel = wrapImageModel({
        model: new MockImageModelV4({ maxImagesPerCall: 2 }),
        middleware: {
          specificationVersion: 'v4',
          overrideMaxImagesPerCall: () => 3,
        },
      });

      expect(wrappedModel.maxImagesPerCall).toBe(3);
    });
  });

  it('should call transformParams middleware for doGenerate', async () => {
    let capturedArgs!: Parameters<MockImageModelV4['doGenerate']>[0];

    const mockModel = new MockImageModelV4({
      doGenerate: vi.fn().mockImplementation(async args => {
        capturedArgs = args;
        return {
          images: [],
          warnings: [],
          response: {
            timestamp: new Date(),
            modelId: 'test-model-id',
            headers: undefined,
          },
        };
      }),
    });

    const transformParams = vi.fn().mockImplementation(({ params }) => ({
      ...params,
      prompt: 'transformed',
    }));

    const wrappedModel = wrapImageModel({
      model: mockModel,
      middleware: {
        specificationVersion: 'v4',
        transformParams,
      },
    });

    const params: ImageModelV4CallOptions = {
      prompt: 'original',
      n: 1,
      size: undefined,
      aspectRatio: undefined,
      seed: undefined,
      files: undefined,
      mask: undefined,
      providerOptions: {},
    };

    await wrappedModel.doGenerate(params);

    expect(transformParams).toHaveBeenCalledWith({
      params,
      model: expect.any(Object),
    });

    expect(capturedArgs).toStrictEqual({
      ...params,
      prompt: 'transformed',
    });
  });

  it('should call wrapGenerate middleware', async () => {
    const mockModel = new MockImageModelV4({
      doGenerate: vi.fn().mockResolvedValue({
        images: [],
        warnings: [],
        response: {
          timestamp: new Date(),
          modelId: 'test-model-id',
          headers: undefined,
        },
      }),
    });

    const wrapGenerate = vi
      .fn()
      .mockImplementation(({ doGenerate }) => doGenerate());

    const wrappedModel = wrapImageModel({
      model: mockModel,
      middleware: {
        specificationVersion: 'v4',
        wrapGenerate,
      },
    });

    const params: ImageModelV4CallOptions = {
      prompt: 'original',
      n: 1,
      size: undefined,
      aspectRatio: undefined,
      seed: undefined,
      files: undefined,
      mask: undefined,
      providerOptions: {},
    };

    await wrappedModel.doGenerate(params);

    expect(wrapGenerate).toHaveBeenCalledWith({
      doGenerate: expect.any(Function),
      params,
      model: mockModel,
    });
  });

  it('should support models that use \"this\" context in maxImagesPerCall', async () => {
    let maxImagesPerCallThis: unknown = undefined;

    class MockImageModelWithThisContext extends MockImageModelV4 {
      readonly value = 42;

      constructor() {
        super({
          maxImagesPerCall: function () {
            maxImagesPerCallThis = this;
            return (this as any).value;
          },
        });
      }
    }

    const model = new MockImageModelWithThisContext();

    const wrappedModel = wrapImageModel({
      model,
      middleware: { specificationVersion: 'v4' },
    });

    if (!(wrappedModel.maxImagesPerCall instanceof Function)) {
      throw new Error('Expected maxImagesPerCall to be a function');
    }

    const result = await wrappedModel.maxImagesPerCall({
      modelId: wrappedModel.modelId,
    });

    expect(result).toBe(42);
    expect(maxImagesPerCallThis).toBe(model);
  });

  describe('multiple middlewares', () => {
    it('should call multiple transformParams middlewares in sequence for doGenerate', async () => {
      let capturedArgs!: Parameters<MockImageModelV4['doGenerate']>[0];

      const mockModel = new MockImageModelV4({
        doGenerate: async args => {
          capturedArgs = args;
          return {
            images: [],
            warnings: [],
            response: {
              timestamp: new Date(),
              modelId: 'test-model-id',
              headers: undefined,
            },
          };
        },
      });

      const transformParams1 = vi.fn().mockImplementation(({ params }) => ({
        ...params,
        transformationStep1: true,
      }));

      const transformParams2 = vi.fn().mockImplementation(({ params }) => ({
        ...params,
        transformationStep2: true,
      }));

      const wrappedModel = wrapImageModel({
        model: mockModel,
        middleware: [
          {
            specificationVersion: 'v4',
            transformParams: transformParams1,
          },
          {
            specificationVersion: 'v4',
            transformParams: transformParams2,
          },
        ],
      });

      const params: ImageModelV4CallOptions = {
        prompt: 'original',
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        files: undefined,
        mask: undefined,
        providerOptions: {},
      };

      await wrappedModel.doGenerate(params);

      expect(transformParams1).toHaveBeenCalledWith({
        params,
        model: expect.any(Object),
      });

      expect(transformParams2).toHaveBeenCalledWith({
        params: { ...params, transformationStep1: true },
        model: expect.any(Object),
      });

      expect(capturedArgs).toStrictEqual(
        expect.objectContaining({
          transformationStep1: true,
          transformationStep2: true,
        }),
      );
    });

    it('should chain multiple wrapGenerate middlewares in the correct order', async () => {
      const mockModel = new MockImageModelV4({
        doGenerate: vi.fn().mockResolvedValue({
          images: [],
          warnings: [],
          response: {
            timestamp: new Date(),
            modelId: 'test-model-id',
            headers: undefined,
          },
        }),
      });

      const wrapGenerate1 = vi
        .fn()
        .mockImplementation(async ({ doGenerate }) => {
          const result = await doGenerate();
          return {
            ...result,
            wrapped: `wrapGenerate1(${(result as any).wrapped ?? 'result'})`,
          };
        });

      const wrapGenerate2 = vi
        .fn()
        .mockImplementation(async ({ doGenerate }) => {
          const result = await doGenerate();
          return {
            ...result,
            wrapped: `wrapGenerate2(${(result as any).wrapped ?? 'result'})`,
          };
        });

      const wrappedModel = wrapImageModel({
        model: mockModel,
        middleware: [
          {
            specificationVersion: 'v4',
            wrapGenerate: wrapGenerate1,
          },
          {
            specificationVersion: 'v4',
            wrapGenerate: wrapGenerate2,
          },
        ],
      });

      const params: ImageModelV4CallOptions = {
        prompt: 'original',
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        files: undefined,
        mask: undefined,
        providerOptions: {},
      };

      const result = await wrappedModel.doGenerate(params);

      expect((result as any).wrapped).toBe(
        'wrapGenerate1(wrapGenerate2(result))',
      );
      expect(wrapGenerate1).toHaveBeenCalled();
      expect(wrapGenerate2).toHaveBeenCalled();
    });

    it('should not mutate the middleware array argument', async () => {
      const middleware1 = {
        specificationVersion: 'v4',
        wrapStream: vi.fn(),
      };

      const middleware2 = {
        specificationVersion: 'v4',
        wrapStream: vi.fn(),
      };

      const middlewares = [
        middleware1,
        middleware2,
      ] as ImageModelV4Middleware[];

      wrapImageModel({
        model: new MockImageModelV4(),
        middleware: middlewares,
      });

      expect(middlewares.length).toBe(2);
      expect(middlewares[0]).toBe(middleware1);
      expect(middlewares[1]).toBe(middleware2);
    });
  });
});
