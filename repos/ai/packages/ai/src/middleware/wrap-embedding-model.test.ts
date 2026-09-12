import type {
  EmbeddingModelV4CallOptions,
  EmbeddingModelV4Middleware,
} from '@ai-sdk/provider';
import { wrapEmbeddingModel } from '../middleware/wrap-embedding-model';
import { describe, it, expect, vi } from 'vitest';
import { MockEmbeddingModelV4 } from '../test/mock-embedding-model-v4';

describe('wrapEmbeddingModel', () => {
  describe('model property', () => {
    it('should pass through by default', () => {
      const wrappedModel = wrapEmbeddingModel({
        model: new MockEmbeddingModelV4({
          modelId: 'test-model',
        }),
        middleware: {
          specificationVersion: 'v4',
        },
      });

      expect(wrappedModel.modelId).toBe('test-model');
    });

    it('should use middleware overrideModelId if provided', () => {
      const wrappedModel = wrapEmbeddingModel({
        model: new MockEmbeddingModelV4({
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
      const wrappedModel = wrapEmbeddingModel({
        model: new MockEmbeddingModelV4({
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
      const wrappedModel = wrapEmbeddingModel({
        model: new MockEmbeddingModelV4({
          provider: 'test-provider',
        }),
        middleware: {
          specificationVersion: 'v4',
        },
      });

      expect(wrappedModel.provider).toBe('test-provider');
    });

    it('should use middleware overrideProvider if provided', () => {
      const wrappedModel = wrapEmbeddingModel({
        model: new MockEmbeddingModelV4({
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
      const wrappedModel = wrapEmbeddingModel({
        model: new MockEmbeddingModelV4({
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

  describe('maxEmbeddingsPerCall property', () => {
    it('should pass through by default', async () => {
      const maxEmbeddingsPerCall = 2;

      const wrappedModel = wrapEmbeddingModel({
        model: new MockEmbeddingModelV4({ maxEmbeddingsPerCall }),
        middleware: {
          specificationVersion: 'v4',
        },
      });

      expect(await wrappedModel.maxEmbeddingsPerCall).toStrictEqual(2);
    });

    it('should use middleware overrideSupportedUrls if provided', () => {
      const wrappedModel = wrapEmbeddingModel({
        model: new MockEmbeddingModelV4({
          maxEmbeddingsPerCall: 2,
        }),
        middleware: {
          specificationVersion: 'v4',
          overrideMaxEmbeddingsPerCall: ({ model }) => 3,
        },
      });

      expect(wrappedModel.maxEmbeddingsPerCall).toStrictEqual(3);
    });
  });

  describe('supportsParallelCalls property', () => {
    it('should pass through by default', async () => {
      const supportsParallelCalls = true;

      const wrappedModel = wrapEmbeddingModel({
        model: new MockEmbeddingModelV4({ supportsParallelCalls }),
        middleware: {
          specificationVersion: 'v4',
        },
      });

      expect(await wrappedModel.supportsParallelCalls).toStrictEqual(true);
    });

    it('should use middleware overrideSupportsParallelCalls if provided', () => {
      const wrappedModel = wrapEmbeddingModel({
        model: new MockEmbeddingModelV4({
          supportsParallelCalls: false,
        }),
        middleware: {
          specificationVersion: 'v4',
          overrideSupportsParallelCalls: ({ model }) => true,
        },
      });

      expect(wrappedModel.supportsParallelCalls).toStrictEqual(true);
    });
  });

  it('should call transformParams middleware for doEmbed', async () => {
    const mockModel = new MockEmbeddingModelV4({
      doEmbed: [],
    });

    const transformParams = vi.fn().mockImplementation(({ params }) => ({
      ...params,
      transformed: true,
    }));

    const wrappedModel = wrapEmbeddingModel({
      model: mockModel,
      middleware: {
        specificationVersion: 'v4',
        transformParams,
      },
    });

    const params: EmbeddingModelV4CallOptions = {
      values: [
        'sunny day at the beach',
        'rainy afternoon in the city',
        'snowy night in the mountains',
      ],
    };

    await wrappedModel.doEmbed(params);

    expect(transformParams).toHaveBeenCalledWith({
      params,
      model: expect.any(Object),
    });

    expect(mockModel.doEmbedCalls[0]).toStrictEqual({
      ...params,
      transformed: true,
    });
  });

  it('should call wrapEmbed middleware', async () => {
    const mockModel = new MockEmbeddingModelV4({
      doEmbed: vi.fn().mockResolvedValue('mock result'),
    });

    const wrapEmbed = vi.fn().mockImplementation(({ doEmbed }) => doEmbed());

    const wrappedModel = wrapEmbeddingModel({
      model: mockModel,
      middleware: {
        specificationVersion: 'v4',
        wrapEmbed,
      },
    });

    const params: EmbeddingModelV4CallOptions = {
      values: [
        'sunny day at the beach',
        'rainy afternoon in the city',
        'snowy night in the mountains',
      ],
    };

    await wrappedModel.doEmbed(params);

    expect(wrapEmbed).toHaveBeenCalledWith({
      doEmbed: expect.any(Function),
      params,
      model: mockModel,
    });
  });

  describe('multiple middlewares', () => {
    it('should call multiple transformParams middlewares in sequence for doEmbed', async () => {
      const mockModel = new MockEmbeddingModelV4({
        doEmbed: [],
      });

      const transformParams1 = vi.fn().mockImplementation(({ params }) => ({
        ...params,
        transformationStep1: true,
      }));

      const transformParams2 = vi.fn().mockImplementation(({ params }) => ({
        ...params,
        transformationStep2: true,
      }));

      const wrappedModel = wrapEmbeddingModel({
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

      const params: EmbeddingModelV4CallOptions = {
        values: [
          'sunny day at the beach',
          'rainy afternoon in the city',
          'snowy night in the mountains',
        ],
      };

      await wrappedModel.doEmbed(params);

      expect(transformParams1).toHaveBeenCalledWith({
        params,
        model: expect.any(Object),
      });

      expect(transformParams2).toHaveBeenCalledWith({
        params: { ...params, transformationStep1: true },
        model: expect.any(Object),
      });

      expect(mockModel.doEmbedCalls[0]).toStrictEqual(
        expect.objectContaining({
          transformationStep1: true,
          transformationStep2: true,
        }),
      );
    });

    it('should chain multiple wrapEmbed middlewares in the correct order', async () => {
      const mockModel = new MockEmbeddingModelV4({
        doEmbed: vi.fn().mockResolvedValue('final generate result'),
      });

      const wrapEmbed1 = vi
        .fn()
        .mockImplementation(async ({ doEmbed, params, model }) => {
          const result = await doEmbed();
          return `wrapEmbed1(${result})`;
        });

      const wrapEmbed2 = vi
        .fn()
        .mockImplementation(async ({ doEmbed, params, model }) => {
          const result = await doEmbed();
          return `wrapEmbed2(${result})`;
        });

      const wrappedModel = wrapEmbeddingModel({
        model: mockModel,
        middleware: [
          {
            specificationVersion: 'v4',
            wrapEmbed: wrapEmbed1,
          },
          {
            specificationVersion: 'v4',
            wrapEmbed: wrapEmbed2,
          },
        ],
      });

      const params: EmbeddingModelV4CallOptions = {
        values: [
          'sunny day at the beach',
          'rainy afternoon in the city',
          'snowy night in the mountains',
        ],
      };

      const result = await wrappedModel.doEmbed(params);

      // The middlewares should wrap in order, applying wrapEmbed2 last
      expect(result).toBe('wrapEmbed1(wrapEmbed2(final generate result))');
      expect(wrapEmbed1).toHaveBeenCalled();
      expect(wrapEmbed2).toHaveBeenCalled();
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
      ] as EmbeddingModelV4Middleware[];

      wrapEmbeddingModel({
        model: new MockEmbeddingModelV4(),
        middleware: middlewares,
      });

      expect(middlewares.length).toBe(2);
      expect(middlewares[0]).toBe(middleware1);
      expect(middlewares[1]).toBe(middleware2);
    });
  });
});
