import type { EmbeddingModelV4CallOptions } from '@ai-sdk/provider';
import { defaultEmbeddingSettingsMiddleware } from './default-embedding-settings-middleware';
import { MockEmbeddingModelV4 } from '../test/mock-embedding-model-v4';
import { describe, it, expect } from 'vitest';

const params: EmbeddingModelV4CallOptions = {
  values: ['hello world'],
};

const mockModel = new MockEmbeddingModelV4();

describe('headers', () => {
  it('should merge headers', async () => {
    const middleware = defaultEmbeddingSettingsMiddleware({
      settings: {
        headers: { 'X-Custom-Header': 'test', 'X-Another-Header': 'test2' },
      },
    });
    const result = await middleware.transformParams!({
      params: {
        ...params,
        headers: { 'X-Custom-Header': 'test2' },
      },
      model: mockModel,
    });
    expect(result.headers).toEqual({
      'X-Custom-Header': 'test2',
      'X-Another-Header': 'test2',
    });
  });

  it('should handle empty default headers', async () => {
    const middleware = defaultEmbeddingSettingsMiddleware({
      settings: { headers: {} },
    });
    const result = await middleware.transformParams!({
      params: { ...params, headers: { 'X-Param-Header': 'param' } },
      model: mockModel,
    });
    expect(result.headers).toEqual({ 'X-Param-Header': 'param' });
  });

  it('should handle empty param headers', async () => {
    const middleware = defaultEmbeddingSettingsMiddleware({
      settings: { headers: { 'X-Default-Header': 'default' } },
    });
    const result = await middleware.transformParams!({
      params: { ...params, headers: {} },
      model: mockModel,
    });
    expect(result.headers).toEqual({ 'X-Default-Header': 'default' });
  });

  it('should handle both headers being undefined', async () => {
    const middleware = defaultEmbeddingSettingsMiddleware({
      settings: {},
    });
    const result = await middleware.transformParams!({
      params: { ...params },
      model: mockModel,
    });
    expect(result.headers).toBeUndefined();
  });
});

describe('providerOptions', () => {
  it('should handle empty default providerOptions', async () => {
    const middleware = defaultEmbeddingSettingsMiddleware({
      settings: {
        providerOptions: {},
      },
    });
    const result = await middleware.transformParams!({
      params: {
        ...params,
        providerOptions: {
          google: {
            outputDimensionality: 512,
            taskType: 'SEMANTIC_SIMILARITY',
          },
        },
      },
      model: mockModel,
    });
    expect(result.providerOptions).toEqual({
      google: {
        outputDimensionality: 512,
        taskType: 'SEMANTIC_SIMILARITY',
      },
    });
  });

  it('should handle empty param providerOptions', async () => {
    const middleware = defaultEmbeddingSettingsMiddleware({
      settings: {
        providerOptions: {
          google: {
            outputDimensionality: 512,
            taskType: 'SEMANTIC_SIMILARITY',
          },
        },
      },
    });
    const result = await middleware.transformParams!({
      params: { ...params, providerOptions: {} },
      model: mockModel,
    });
    expect(result.providerOptions).toEqual({
      google: {
        outputDimensionality: 512,
        taskType: 'SEMANTIC_SIMILARITY',
      },
    });
  });

  it('should handle both providerOptions being undefined', async () => {
    const middleware = defaultEmbeddingSettingsMiddleware({
      settings: {},
    });
    const result = await middleware.transformParams!({
      params: { ...params },
      model: mockModel,
    });
    expect(result.providerOptions).toBeUndefined();
  });
});
