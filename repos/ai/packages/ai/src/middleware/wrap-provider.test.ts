import { MockLanguageModelV2 } from '../test/mock-language-model-v2';
import { MockLanguageModelV4 } from '../test/mock-language-model-v4';
import { MockImageModelV4 } from '../test/mock-image-model-v4';
import { MockProviderV2 } from '../test/mock-provider-v2';
import { MockProviderV4 } from '../test/mock-provider-v4';
import { wrapProvider } from './wrap-provider';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

describe('wrapProvider', () => {
  let mockProcessEmitWarning: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockProcessEmitWarning = vi
      .spyOn(process, 'emitWarning')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    mockProcessEmitWarning.mockRestore();
  });

  it('should wrap all language models in the provider', () => {
    const model1 = new MockLanguageModelV4({ modelId: 'model-1' });
    const model2 = new MockLanguageModelV4({ modelId: 'model-2' });
    const model3 = new MockLanguageModelV4({ modelId: 'model-3' });

    const provider = new MockProviderV4({
      languageModels: {
        'model-1': model1,
        'model-2': model2,
        'model-3': model3,
      },
    });

    const overrideModelId = vi
      .fn()
      .mockImplementation(({ model }) => `override-${model.modelId}`);

    const wrappedProvider = wrapProvider({
      provider,
      languageModelMiddleware: {
        specificationVersion: 'v4',
        overrideModelId,
      },
    });

    expect(wrappedProvider.languageModel('model-1').modelId).toBe(
      'override-model-1',
    );
    expect(wrappedProvider.languageModel('model-2').modelId).toBe(
      'override-model-2',
    );
    expect(wrappedProvider.languageModel('model-3').modelId).toBe(
      'override-model-3',
    );

    expect(overrideModelId).toHaveBeenCalledTimes(3);
    expect(overrideModelId.mock.calls[0][0].model.modelId).toBe('model-1');
    expect(overrideModelId.mock.calls[1][0].model.modelId).toBe('model-2');
    expect(overrideModelId.mock.calls[2][0].model.modelId).toBe('model-3');
  });

  it('should work when the provider is a ProviderV2', () => {
    const v2Model1 = new MockLanguageModelV2({ modelId: 'model-1' });
    const v2Model2 = new MockLanguageModelV2({ modelId: 'model-2' });

    const providerV2 = new MockProviderV2({
      languageModels: {
        'model-1': v2Model1,
        'model-2': v2Model2,
      },
    });

    const wrapped = wrapProvider({
      provider: providerV2,
      languageModelMiddleware: {
        specificationVersion: 'v4',
        overrideModelId: ({ model }) => `override-${model.modelId}`,
      },
    });

    expect(wrapped.languageModel('model-1').modelId).toBe('override-model-1');
    expect(wrapped.languageModel('model-2').modelId).toBe('override-model-2');
  });

  it('should wrap all image models in the provider when image middleware is provided', () => {
    const model1 = new MockImageModelV4({ modelId: 'model-1' });
    const model2 = new MockImageModelV4({ modelId: 'model-2' });
    const model3 = new MockImageModelV4({ modelId: 'model-3' });

    const provider = new MockProviderV4({
      languageModels: {
        'language-model': new MockLanguageModelV4({
          modelId: 'language-model',
        }),
      },
      imageModels: {
        'model-1': model1,
        'model-2': model2,
        'model-3': model3,
      },
    });

    const overrideModelId = vi
      .fn()
      .mockImplementation(({ model }) => `override-${model.modelId}`);

    const wrappedProvider = wrapProvider({
      provider,
      languageModelMiddleware: { specificationVersion: 'v4' },
      imageModelMiddleware: {
        specificationVersion: 'v4',
        overrideModelId,
      },
    });

    expect(wrappedProvider.imageModel('model-1').modelId).toBe(
      'override-model-1',
    );
    expect(wrappedProvider.imageModel('model-2').modelId).toBe(
      'override-model-2',
    );
    expect(wrappedProvider.imageModel('model-3').modelId).toBe(
      'override-model-3',
    );

    expect(overrideModelId).toHaveBeenCalledTimes(3);
    expect(overrideModelId.mock.calls[0][0].model.modelId).toBe('model-1');
    expect(overrideModelId.mock.calls[1][0].model.modelId).toBe('model-2');
    expect(overrideModelId.mock.calls[2][0].model.modelId).toBe('model-3');
  });
});
