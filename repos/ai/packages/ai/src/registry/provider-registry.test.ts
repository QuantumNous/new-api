import {
  type FilesV4,
  NoSuchModelError,
  type SkillsV4,
} from '@ai-sdk/provider';
import { MockEmbeddingModelV4 } from '../test/mock-embedding-model-v4';
import { MockEmbeddingModelV3 } from '../test/mock-embedding-model-v3';
import { MockLanguageModelV4 } from '../test/mock-language-model-v4';
import { MockLanguageModelV3 } from '../test/mock-language-model-v3';
import { NoSuchProviderError } from './no-such-provider-error';
import { createProviderRegistry } from './provider-registry';
import { MockImageModelV4 } from '../test/mock-image-model-v4';
import { MockImageModelV3 } from '../test/mock-image-model-v3';
import { MockTranscriptionModelV4 } from '../test/mock-transcription-model-v4';
import { MockTranscriptionModelV3 } from '../test/mock-transcription-model-v3';
import { MockSpeechModelV4 } from '../test/mock-speech-model-v4';
import { MockSpeechModelV3 } from '../test/mock-speech-model-v3';
import { MockRerankingModelV4 } from '../test/mock-reranking-model-v4';
import { MockRerankingModelV3 } from '../test/mock-reranking-model-v3';
import { MockVideoModelV4 } from '../test/mock-video-model-v4';
import { MockVideoModelV3 } from '../test/mock-video-model-v3';
import { MockProviderV4 } from '../test/mock-provider-v4';
import { MockProviderV3 } from '../test/mock-provider-v3';
import { describe, it, expect, vi } from 'vitest';

describe('languageModel', () => {
  it('should return language model from provider', () => {
    const model = new MockLanguageModelV4();

    const modelRegistry = createProviderRegistry({
      provider: {
        specificationVersion: 'v4',
        languageModel: (id: string) => {
          expect(id).toEqual('model');
          return model;
        },
        embeddingModel: (id: string) => {
          return null as any;
        },
        imageModel: (id: string) => {
          return null as any;
        },
        rerankingModel: (id: string) => {
          return null as any;
        },
      },
    });

    expect(modelRegistry.languageModel('provider:model')).toEqual(model);
  });

  it('should return language model with additional colon from provider', () => {
    const model = new MockLanguageModelV4();

    const modelRegistry = createProviderRegistry({
      provider: {
        specificationVersion: 'v4',
        languageModel: id => {
          expect(id).toEqual('model:part2');
          return model;
        },
        embeddingModel: () => {
          return null as any;
        },
        imageModel: () => {
          return null as any;
        },
        rerankingModel: (id: string) => {
          return null as any;
        },
      },
    });

    expect(modelRegistry.languageModel('provider:model:part2')).toEqual(model);
  });

  it('should throw NoSuchProviderError if provider does not exist', () => {
    const registry = createProviderRegistry({});

    // @ts-expect-error - should not accept arbitrary strings
    expect(() => registry.languageModel('provider:model:part2')).toThrowError(
      NoSuchProviderError,
    );
  });

  it('should throw NoSuchModelError if provider does not return a model', () => {
    const registry = createProviderRegistry({
      provider: {
        specificationVersion: 'v4',
        languageModel: () => {
          return null as any;
        },
        embeddingModel: () => {
          return null as any;
        },
        imageModel: () => {
          return null as any;
        },
        transcriptionModel: () => {
          return null as any;
        },
        speechModel: () => {
          return null as any;
        },
        rerankingModel: () => {
          return null as any;
        },
      },
    });

    expect(() => registry.languageModel('provider:model')).toThrowError(
      NoSuchModelError,
    );
  });

  it("should throw NoSuchModelError if model id doesn't contain a colon", () => {
    const registry = createProviderRegistry({});

    // @ts-expect-error - should not accept arbitrary strings
    expect(() => registry.languageModel('model')).toThrowError(
      NoSuchModelError,
    );
  });

  it('should support custom separator', () => {
    const model = new MockLanguageModelV4();

    const modelRegistry = createProviderRegistry(
      {
        provider: {
          specificationVersion: 'v4',
          languageModel: id => {
            expect(id).toEqual('model');
            return model;
          },
          embeddingModel: () => {
            return null as any;
          },
          imageModel: () => {
            return null as any;
          },
          transcriptionModel: () => {
            return null as any;
          },
          speechModel: () => {
            return null as any;
          },
          rerankingModel: () => {
            return null as any;
          },
        },
      },
      { separator: '|' },
    );

    expect(modelRegistry.languageModel('provider|model')).toEqual(model);
  });

  it('should support custom separator with multiple characters', () => {
    const model = new MockLanguageModelV4();

    const modelRegistry = createProviderRegistry(
      {
        provider: {
          specificationVersion: 'v4',
          languageModel: id => {
            expect(id).toEqual('model');
            return model;
          },
          embeddingModel: () => {
            return null as any;
          },
          imageModel: () => {
            return null as any;
          },
          transcriptionModel: () => {
            return null as any;
          },
          speechModel: () => {
            return null as any;
          },
          rerankingModel: () => {
            return null as any;
          },
        },
      },
      { separator: ' > ' },
    );

    expect(modelRegistry.languageModel('provider > model')).toEqual(model);
  });
});

describe('embeddingModel', () => {
  it('should return embedding model from provider using embeddingModel', () => {
    const model = new MockEmbeddingModelV4();

    const modelRegistry = createProviderRegistry({
      provider: {
        specificationVersion: 'v4',
        embeddingModel: id => {
          expect(id).toEqual('model');
          return model;
        },
        languageModel: () => {
          return null as any;
        },
        imageModel: () => {
          return null as any;
        },
        transcriptionModel: () => {
          return null as any;
        },
        speechModel: () => {
          return null as any;
        },
        rerankingModel: () => {
          return null as any;
        },
      },
    });

    expect(modelRegistry.embeddingModel('provider:model')).toEqual(model);
  });

  it('should throw NoSuchProviderError if provider does not exist', () => {
    const registry = createProviderRegistry({});

    // @ts-expect-error - should not accept arbitrary strings
    expect(() => registry.embeddingModel('provider:model')).toThrowError(
      NoSuchProviderError,
    );
  });

  it('should throw NoSuchModelError if provider does not return a model', () => {
    const registry = createProviderRegistry({
      provider: {
        specificationVersion: 'v4',
        embeddingModel: () => {
          return null as any;
        },
        languageModel: () => {
          return null as any;
        },
        imageModel: () => {
          return null as any;
        },
        rerankingModel: (id: string) => {
          return null as any;
        },
      },
    });

    expect(() => registry.languageModel('provider:model')).toThrowError(
      NoSuchModelError,
    );
  });

  it("should throw NoSuchModelError if model id doesn't contain a colon", () => {
    const registry = createProviderRegistry({});

    // @ts-expect-error - should not accept arbitrary strings
    expect(() => registry.embeddingModel('model')).toThrowError(
      NoSuchModelError,
    );
  });

  it('should support custom separator', () => {
    const model = new MockEmbeddingModelV4();

    const modelRegistry = createProviderRegistry(
      {
        provider: {
          specificationVersion: 'v4',
          embeddingModel: id => {
            expect(id).toEqual('model');
            return model;
          },
          languageModel: () => {
            return null as any;
          },
          imageModel: () => {
            return null as any;
          },
          transcriptionModel: () => {
            return null as any;
          },
          speechModel: () => {
            return null as any;
          },
          rerankingModel: (id: string) => {
            return null as any;
          },
        },
      },
      { separator: '|' },
    );

    expect(modelRegistry.embeddingModel('provider|model')).toEqual(model);
  });
});

describe('imageModel', () => {
  it('should return image model from provider', () => {
    const model = new MockImageModelV4();

    const modelRegistry = createProviderRegistry({
      provider: {
        specificationVersion: 'v4',
        imageModel: id => {
          expect(id).toEqual('model');
          return model;
        },
        languageModel: () => null as any,
        embeddingModel: () => null as any,
        transcriptionModel: () => null as any,
        speechModel: () => null as any,
        rerankingModel: () => null as any,
      },
    });

    expect(modelRegistry.imageModel('provider:model')).toEqual(model);
  });

  it('should throw NoSuchProviderError if provider does not exist', () => {
    const registry = createProviderRegistry({});

    // @ts-expect-error - should not accept arbitrary strings
    expect(() => registry.imageModel('provider:model')).toThrowError(
      NoSuchProviderError,
    );
  });

  it('should throw NoSuchModelError if provider does not return a model', () => {
    const registry = createProviderRegistry({
      provider: {
        specificationVersion: 'v4',
        imageModel: () => null as any,
        languageModel: () => null as any,
        embeddingModel: () => null as any,
        transcriptionModel: () => null as any,
        rerankingModel: () => null as any,
      },
    });

    expect(() => registry.imageModel('provider:model')).toThrowError(
      NoSuchModelError,
    );
  });

  it("should throw NoSuchModelError if model id doesn't contain a colon", () => {
    const registry = createProviderRegistry({});

    // @ts-expect-error - should not accept arbitrary strings
    expect(() => registry.imageModel('model')).toThrowError(NoSuchModelError);
  });

  it('should support custom separator', () => {
    const model = new MockImageModelV4();

    const modelRegistry = createProviderRegistry(
      {
        provider: {
          specificationVersion: 'v4',
          imageModel: id => {
            expect(id).toEqual('model');
            return model;
          },
          languageModel: () => null as any,
          embeddingModel: () => null as any,
          rerankingModel: () => null as any,
        },
      },
      { separator: '|' },
    );

    expect(modelRegistry.imageModel('provider|model')).toEqual(model);
  });
});

describe('transcriptionModel', () => {
  it('should return transcription model from provider', () => {
    const model = new MockTranscriptionModelV4();

    const modelRegistry = createProviderRegistry({
      provider: {
        specificationVersion: 'v4',
        transcriptionModel: id => {
          expect(id).toEqual('model');
          return model;
        },
        languageModel: () => null as any,
        embeddingModel: () => null as any,
        imageModel: () => null as any,
        rerankingModel: () => null as any,
      },
    });

    expect(modelRegistry.transcriptionModel('provider:model')).toEqual(model);
  });

  it('should throw NoSuchProviderError if provider does not exist', () => {
    const registry = createProviderRegistry({});

    // @ts-expect-error - should not accept arbitrary strings
    expect(() => registry.transcriptionModel('provider:model')).toThrowError(
      NoSuchProviderError,
    );
  });

  it('should throw NoSuchModelError if provider does not return a model', () => {
    const registry = createProviderRegistry({
      provider: {
        specificationVersion: 'v4',
        transcriptionModel: () => null as any,
        languageModel: () => null as any,
        embeddingModel: () => null as any,
        imageModel: () => null as any,
        rerankingModel: () => null as any,
      },
    });

    expect(() => registry.transcriptionModel('provider:model')).toThrowError(
      NoSuchModelError,
    );
  });

  it("should throw NoSuchModelError if model id doesn't contain a colon", () => {
    const registry = createProviderRegistry({});

    // @ts-expect-error - should not accept arbitrary strings
    expect(() => registry.transcriptionModel('model')).toThrowError(
      NoSuchModelError,
    );
  });
});

describe('speechModel', () => {
  it('should return speech model from provider', () => {
    const model = new MockSpeechModelV4();

    const modelRegistry = createProviderRegistry({
      provider: {
        specificationVersion: 'v4',
        speechModel: id => {
          expect(id).toEqual('model');
          return model;
        },
        languageModel: () => null as any,
        embeddingModel: () => null as any,
        imageModel: () => null as any,
        rerankingModel: () => null as any,
      },
    });

    expect(modelRegistry.speechModel('provider:model')).toEqual(model);
  });

  it('should throw NoSuchProviderError if provider does not exist', () => {
    const registry = createProviderRegistry({});

    // @ts-expect-error - should not accept arbitrary strings
    expect(() => registry.speechModel('provider:model')).toThrowError(
      NoSuchProviderError,
    );
  });

  it('should throw NoSuchModelError if provider does not return a model', () => {
    const registry = createProviderRegistry({
      provider: {
        specificationVersion: 'v4',
        speechModel: () => null as any,
        languageModel: () => null as any,
        embeddingModel: () => null as any,
        imageModel: () => null as any,
        rerankingModel: () => null as any,
      },
    });

    expect(() => registry.speechModel('provider:model')).toThrowError(
      NoSuchModelError,
    );
  });

  it("should throw NoSuchModelError if model id doesn't contain a colon", () => {
    const registry = createProviderRegistry({});

    // @ts-expect-error - should not accept arbitrary strings
    expect(() => registry.speechModel('model')).toThrowError(NoSuchModelError);
  });
});

describe('rerankingModel', () => {
  it('should return reranking model from provider using rerankingModel', () => {
    const model = new MockRerankingModelV4();

    const modelRegistry = createProviderRegistry({
      provider: {
        specificationVersion: 'v4',
        rerankingModel: id => {
          expect(id).toEqual('model');
          return model;
        },
        embeddingModel: () => {
          return null as any;
        },
        languageModel: () => {
          return null as any;
        },
        imageModel: () => {
          return null as any;
        },
        transcriptionModel: () => {
          return null as any;
        },
        speechModel: () => {
          return null as any;
        },
      },
    });

    expect(modelRegistry.rerankingModel('provider:model')).toEqual(model);
  });

  it('should throw NoSuchProviderError if provider does not exist', () => {
    const registry = createProviderRegistry({});

    // @ts-expect-error - should not accept arbitrary strings
    expect(() => registry.rerankingModel('provider:model')).toThrowError(
      NoSuchProviderError,
    );
  });

  it('should throw NoSuchModelError if provider does not return a model', () => {
    const registry = createProviderRegistry({
      provider: {
        specificationVersion: 'v4',
        embeddingModel: () => {
          return null as any;
        },
        languageModel: () => {
          return null as any;
        },
        imageModel: () => {
          return null as any;
        },
        rerankingModel: (id: string) => {
          return null as any;
        },
      },
    });

    expect(() => registry.rerankingModel('provider:model')).toThrowError(
      NoSuchModelError,
    );
  });

  it("should throw NoSuchModelError if model id doesn't contain a colon", () => {
    const registry = createProviderRegistry({});

    // @ts-expect-error - should not accept arbitrary strings
    expect(() => registry.rerankingModel('model')).toThrowError(
      NoSuchModelError,
    );
  });

  it('should support custom separator', () => {
    const model = new MockRerankingModelV4();

    const modelRegistry = createProviderRegistry(
      {
        provider: {
          specificationVersion: 'v4',
          rerankingModel: id => {
            expect(id).toEqual('model');
            return model;
          },
          embeddingModel: () => {
            return null as any;
          },
          languageModel: () => {
            return null as any;
          },
          imageModel: () => {
            return null as any;
          },
          transcriptionModel: () => {
            return null as any;
          },
          speechModel: () => {
            return null as any;
          },
        },
      },
      { separator: '|' },
    );

    expect(modelRegistry.rerankingModel('provider|model')).toEqual(model);
  });
});

describe('videoModel', () => {
  it('should return video model from provider', () => {
    const model = new MockVideoModelV4();

    const modelRegistry = createProviderRegistry({
      provider: {
        specificationVersion: 'v4',
        languageModel: () => null as any,
        embeddingModel: () => null as any,
        imageModel: () => null as any,
        videoModel: (id: string) => {
          expect(id).toEqual('model');
          return model;
        },
      },
    });

    expect(modelRegistry.videoModel('provider:model')).toEqual(model);
  });

  it('should convert v3 video models to v4 on demand', () => {
    const modelRegistry = createProviderRegistry({
      provider: {
        specificationVersion: 'v4',
        languageModel: () => null as any,
        embeddingModel: () => null as any,
        imageModel: () => null as any,
        videoModel: () => new MockVideoModelV3(),
      },
    });

    expect(
      modelRegistry.videoModel('provider:model').specificationVersion,
    ).toBe('v4');
  });

  it('should throw NoSuchProviderError if provider does not exist', () => {
    const registry = createProviderRegistry({});

    // @ts-expect-error - should not accept arbitrary strings
    expect(() => registry.videoModel('provider:model')).toThrowError(
      NoSuchProviderError,
    );
  });

  it('should throw NoSuchModelError if provider does not return a model', () => {
    const registry = createProviderRegistry({
      provider: {
        specificationVersion: 'v4',
        languageModel: () => null as any,
        embeddingModel: () => null as any,
        imageModel: () => null as any,
      },
    });

    expect(() => registry.videoModel('provider:model')).toThrowError(
      NoSuchModelError,
    );
  });

  it("should throw NoSuchModelError if model id doesn't contain a colon", () => {
    const registry = createProviderRegistry({});

    // @ts-expect-error - should not accept arbitrary strings
    expect(() => registry.videoModel('model')).toThrowError(NoSuchModelError);
  });

  it('should support custom separator', () => {
    const model = new MockVideoModelV4();

    const modelRegistry = createProviderRegistry(
      {
        provider: {
          specificationVersion: 'v4',
          languageModel: () => null as any,
          embeddingModel: () => null as any,
          imageModel: () => null as any,
          videoModel: (id: string) => {
            expect(id).toEqual('model');
            return model;
          },
        },
      },
      { separator: '|' },
    );

    expect(modelRegistry.videoModel('provider|model')).toEqual(model);
  });
});

describe('ProviderV3 compatibility', () => {
  it('should adapt ProviderV3 models to ProviderV4 models', () => {
    const provider = new MockProviderV3({
      languageModels: {
        language: new MockLanguageModelV3({
          provider: 'provider',
          modelId: 'language',
        }),
      },
      embeddingModels: {
        embedding: new MockEmbeddingModelV3({
          provider: 'provider',
          modelId: 'embedding',
        }),
      },
      imageModels: {
        image: new MockImageModelV3({
          provider: 'provider',
          modelId: 'image',
        }),
      },
      transcriptionModels: {
        transcription: new MockTranscriptionModelV3({
          provider: 'provider',
          modelId: 'transcription',
        }),
      },
      speechModels: {
        speech: new MockSpeechModelV3({
          provider: 'provider',
          modelId: 'speech',
        }),
      },
      rerankingModels: {
        reranking: new MockRerankingModelV3({
          provider: 'provider',
          modelId: 'reranking',
        }),
      },
    }) as MockProviderV3 & {
      videoModel(modelId: string): MockVideoModelV3;
    };
    provider.videoModel = () =>
      new MockVideoModelV3({
        provider: 'provider',
        modelId: 'video',
      });

    const registry = createProviderRegistry({
      provider,
    });

    expect(
      registry.languageModel('provider:language').specificationVersion,
    ).toBe('v4');
    expect(
      registry.embeddingModel('provider:embedding').specificationVersion,
    ).toBe('v4');
    expect(registry.imageModel('provider:image').specificationVersion).toBe(
      'v4',
    );
    expect(
      registry.transcriptionModel('provider:transcription')
        .specificationVersion,
    ).toBe('v4');
    expect(registry.speechModel('provider:speech').specificationVersion).toBe(
      'v4',
    );
    expect(
      registry.rerankingModel('provider:reranking').specificationVersion,
    ).toBe('v4');
    expect(registry.videoModel('provider:video').specificationVersion).toBe(
      'v4',
    );
  });
});

describe('files and skills', () => {
  const files: FilesV4 = {
    specificationVersion: 'v4',
    provider: 'provider',
    uploadFile: vi.fn(),
  };
  const skills: SkillsV4 = {
    specificationVersion: 'v4',
    provider: 'provider',
    uploadSkill: vi.fn(),
  };

  it('should return files interface from provider', () => {
    const filesSpy = vi.fn().mockReturnValue(files);
    const registry = createProviderRegistry({
      provider: {
        specificationVersion: 'v4',
        languageModel: vi.fn(),
        embeddingModel: vi.fn(),
        imageModel: vi.fn(),
        files: filesSpy,
      },
    });

    expect(registry.files('provider')).toBe(files);
    expect(filesSpy).toHaveBeenCalled();
  });

  it('should return skills interface from provider', () => {
    const skillsSpy = vi.fn().mockReturnValue(skills);
    const registry = createProviderRegistry({
      provider: {
        specificationVersion: 'v4',
        languageModel: vi.fn(),
        embeddingModel: vi.fn(),
        imageModel: vi.fn(),
        skills: skillsSpy,
      },
    });

    expect(registry.skills('provider')).toBe(skills);
    expect(skillsSpy).toHaveBeenCalled();
  });

  it('should throw when provider does not expose files', () => {
    const registry = createProviderRegistry({
      provider: new MockProviderV4(),
    });

    expect(() => registry.files('provider')).toThrow(
      'The provider "provider" does not support file uploads. Make sure it exposes a files() method.',
    );
  });

  it('should throw when provider does not expose skills', () => {
    const registry = createProviderRegistry({
      provider: new MockProviderV4(),
    });

    expect(() => registry.skills('provider')).toThrow(
      'The provider "provider" does not support skills. Make sure it exposes a skills() method.',
    );
  });
});

describe('middleware functionality', () => {
  it('should wrap all language models accessed through the provider registry', () => {
    const model1 = new MockLanguageModelV4({ modelId: 'model-1' });
    const model2 = new MockLanguageModelV4({ modelId: 'model-2' });
    const model3 = new MockLanguageModelV4({ modelId: 'model-3' });

    const provider1 = new MockProviderV4({
      languageModels: {
        'model-1': model1,
        'model-2': model2,
      },
    });

    const provider2 = new MockProviderV4({
      languageModels: {
        'model-3': model3,
      },
    });

    const overrideModelId = vi
      .fn()
      .mockImplementation(({ model }) => `override-${model.modelId}`);

    const registry = createProviderRegistry(
      {
        provider1,
        provider2,
      },
      {
        languageModelMiddleware: {
          specificationVersion: 'v4',
          overrideModelId,
        },
      },
    );

    expect(registry.languageModel('provider1:model-1').modelId).toBe(
      'override-model-1',
    );
    expect(registry.languageModel('provider1:model-2').modelId).toBe(
      'override-model-2',
    );
    expect(registry.languageModel('provider2:model-3').modelId).toBe(
      'override-model-3',
    );

    expect(overrideModelId).toHaveBeenCalledTimes(3);
    expect(overrideModelId).toHaveBeenCalledWith({ model: model1 });
    expect(overrideModelId).toHaveBeenCalledWith({ model: model2 });
    expect(overrideModelId).toHaveBeenCalledWith({ model: model3 });
  });

  it('should wrap all image models accessed through the provider registry', () => {
    const model1 = new MockImageModelV4({ modelId: 'model-1' });
    const model2 = new MockImageModelV4({ modelId: 'model-2' });
    const model3 = new MockImageModelV4({ modelId: 'model-3' });

    const provider1 = new MockProviderV4({
      imageModels: {
        'model-1': model1,
        'model-2': model2,
      },
    });

    const provider2 = new MockProviderV4({
      imageModels: {
        'model-3': model3,
      },
    });

    const overrideModelId = vi
      .fn()
      .mockImplementation(({ model }) => `override-${model.modelId}`);

    const registry = createProviderRegistry(
      {
        provider1,
        provider2,
      },
      {
        imageModelMiddleware: {
          specificationVersion: 'v4',
          overrideModelId,
        },
      },
    );

    expect(registry.imageModel('provider1:model-1').modelId).toBe(
      'override-model-1',
    );
    expect(registry.imageModel('provider1:model-2').modelId).toBe(
      'override-model-2',
    );
    expect(registry.imageModel('provider2:model-3').modelId).toBe(
      'override-model-3',
    );

    expect(overrideModelId).toHaveBeenCalledTimes(3);
    expect(overrideModelId).toHaveBeenCalledWith({ model: model1 });
    expect(overrideModelId).toHaveBeenCalledWith({ model: model2 });
    expect(overrideModelId).toHaveBeenCalledWith({ model: model3 });
  });
});
