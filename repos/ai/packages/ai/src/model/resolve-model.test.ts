import { gateway } from '@ai-sdk/gateway';
import type { EmbeddingModelV2, LanguageModelV2 } from '@ai-sdk/provider';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import { MockEmbeddingModelV3 } from '../test/mock-embedding-model-v3';
import { MockEmbeddingModelV4 } from '../test/mock-embedding-model-v4';
import { MockLanguageModelV3 } from '../test/mock-language-model-v3';
import { MockLanguageModelV4 } from '../test/mock-language-model-v4';
import { MockRerankingModelV3 } from '../test/mock-reranking-model-v3';
import { MockRerankingModelV4 } from '../test/mock-reranking-model-v4';
import { MockSpeechModelV3 } from '../test/mock-speech-model-v3';
import { MockSpeechModelV4 } from '../test/mock-speech-model-v4';
import { MockTranscriptionModelV3 } from '../test/mock-transcription-model-v3';
import { MockTranscriptionModelV4 } from '../test/mock-transcription-model-v4';
import { MockVideoModelV3 } from '../test/mock-video-model-v3';
import { MockVideoModelV4 } from '../test/mock-video-model-v4';
import { customProvider } from '../registry/custom-provider';
import { MockImageModelV2 } from '../test/mock-image-model-v2';
import {
  resolveEmbeddingModel,
  resolveImageModel,
  resolveLanguageModel,
  resolveRerankingModel,
  resolveSpeechModel,
  resolveTranscriptionModel,
  resolveVideoModel,
} from './resolve-model';

let mockProcessEmitWarning: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  mockProcessEmitWarning = vi
    .spyOn(process, 'emitWarning')
    .mockImplementation(() => {});
});

afterEach(() => {
  mockProcessEmitWarning.mockRestore();
});

describe('resolveLanguageModel', () => {
  describe('when a language model v4 is provided', () => {
    it('should return it as-is', () => {
      const originalModel = new MockLanguageModelV4({
        provider: 'test-provider',
        modelId: 'test-model-id',
      });

      const resolvedModel = resolveLanguageModel(originalModel);

      expect(resolvedModel).toBe(originalModel);
      expect(resolvedModel.specificationVersion).toBe('v4');
    });
  });

  describe('when a language model v3 is provided', () => {
    it('should convert v3 to v4', () => {
      const resolvedModel = resolveLanguageModel(
        new MockLanguageModelV3({
          provider: 'test-provider',
          modelId: 'test-model-id',
        }),
      );

      expect(resolvedModel.provider).toBe('test-provider');
      expect(resolvedModel.modelId).toBe('test-model-id');
      expect(resolvedModel.specificationVersion).toBe('v4');
    });
  });

  describe('when a language model v2 is provided', () => {
    it('should adapt to v4 and preserve prototype methods', async () => {
      class TestLanguageModelV2 implements LanguageModelV2 {
        readonly specificationVersion = 'v2' as const;
        readonly provider = 'test-provider';
        readonly modelId = 'test-model-id';
        readonly supportedUrls = {};

        async doGenerate() {
          return {
            content: [],
            finishReason: 'stop' as const,
            usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
            warnings: [],
          };
        }

        async doStream() {
          return { stream: new ReadableStream() };
        }
      }

      const v2 = new TestLanguageModelV2();
      const resolvedModel = resolveLanguageModel(v2);

      expect(resolvedModel.provider).toBe('test-provider');
      expect(resolvedModel.modelId).toBe('test-model-id');
      expect(resolvedModel.specificationVersion).toBe('v4');

      await resolvedModel.doGenerate({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }],
      });

      const { stream } = await resolvedModel.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }],
      });
      expect(stream).toBeInstanceOf(ReadableStream);
    });
  });

  describe('when a string is provided and the global default provider is not set', () => {
    it('should return a gateway language model', () => {
      const resolvedModel = resolveLanguageModel('test-model-id');

      expect(resolvedModel.provider).toBe('gateway');
      expect(resolvedModel.modelId).toBe('test-model-id');
    });
  });

  describe('when a string is provided and the global default provider is set', () => {
    beforeEach(() => {
      globalThis.AI_SDK_DEFAULT_PROVIDER = customProvider({
        languageModels: {
          'test-model-id': new MockLanguageModelV4({
            provider: 'global-test-provider',
            modelId: 'actual-test-model-id',
          }),
        },
      });
    });

    afterEach(() => {
      delete globalThis.AI_SDK_DEFAULT_PROVIDER;
    });

    it('should return a language model from the global default provider', () => {
      const resolvedModel = resolveLanguageModel('test-model-id');

      expect(resolvedModel.provider).toBe('global-test-provider');
      expect(resolvedModel.modelId).toBe('actual-test-model-id');
    });
  });
});

describe('resolveEmbeddingModel', () => {
  describe('when an embedding model v2 is provided', () => {
    it('should adapt to v4 and preserve prototype methods', async () => {
      class TestEmbeddingModelV2 implements EmbeddingModelV2<string> {
        readonly specificationVersion = 'v2' as const;
        readonly provider = 'test-provider';
        readonly modelId = 'test-model-id';
        readonly maxEmbeddingsPerCall = 1;
        readonly supportsParallelCalls = false;

        async doEmbed() {
          return { embeddings: [[0.1, 0.2, 0.3]] };
        }
      }

      const v2 = new TestEmbeddingModelV2();
      const resolvedModel = resolveEmbeddingModel(v2);

      expect(resolvedModel.provider).toBe('test-provider');
      expect(resolvedModel.modelId).toBe('test-model-id');
      expect(resolvedModel.specificationVersion).toBe('v4');

      const result = await resolvedModel.doEmbed({ values: ['hello'] });
      expect(result.embeddings).toHaveLength(1);
    });
  });

  describe('when an embedding model v4 is provided', () => {
    it('should return it as-is', () => {
      const originalModel = new MockEmbeddingModelV4({
        provider: 'test-provider',
        modelId: 'test-model-id',
      });

      const resolvedModel = resolveEmbeddingModel(originalModel);

      expect(resolvedModel).toBe(originalModel);
      expect(resolvedModel.specificationVersion).toBe('v4');
    });
  });

  describe('when an embedding model v3 is provided', () => {
    it('should convert v3 to v4', () => {
      const resolvedModel = resolveEmbeddingModel(
        new MockEmbeddingModelV3({
          provider: 'test-provider',
          modelId: 'test-model-id',
        }),
      );

      expect(resolvedModel.provider).toBe('test-provider');
      expect(resolvedModel.modelId).toBe('test-model-id');
      expect(resolvedModel.specificationVersion).toBe('v4');
    });
  });

  describe('when a string is provided and the global default provider is not set', () => {
    it('should return a gateway embedding model', () => {
      const resolvedModel = resolveEmbeddingModel('test-model-id');

      expect(resolvedModel.provider).toBe('gateway');
      expect(resolvedModel.modelId).toBe('test-model-id');
    });
  });

  describe('when a string is provided and the global default provider is set', () => {
    beforeEach(() => {
      globalThis.AI_SDK_DEFAULT_PROVIDER = customProvider({
        embeddingModels: {
          'test-model-id': new MockEmbeddingModelV4({
            provider: 'global-test-provider',
            modelId: 'actual-test-model-id',
          }),
        },
      });
    });

    afterEach(() => {
      delete globalThis.AI_SDK_DEFAULT_PROVIDER;
    });

    it('should return a embedding model from the global default provider', () => {
      const resolvedModel = resolveEmbeddingModel('test-model-id');

      expect(resolvedModel.provider).toBe('global-test-provider');
      expect(resolvedModel.modelId).toBe('actual-test-model-id');
    });
  });
});

describe('resolveSpeechModel', () => {
  describe('when a speech model v4 is provided', () => {
    it('should return it as-is', () => {
      const originalModel = new MockSpeechModelV4({
        provider: 'test-provider',
        modelId: 'test-model-id',
      });

      const resolvedModel = resolveSpeechModel(originalModel);

      expect(resolvedModel).toBe(originalModel);
      expect(resolvedModel?.specificationVersion).toBe('v4');
    });
  });

  describe('when a speech model v3 is provided', () => {
    it('should convert v3 to v4', () => {
      const resolvedModel = resolveSpeechModel(
        new MockSpeechModelV3({
          provider: 'test-provider',
          modelId: 'test-model-id',
        }),
      );

      expect(resolvedModel?.provider).toBe('test-provider');
      expect(resolvedModel?.modelId).toBe('test-model-id');
      expect(resolvedModel?.specificationVersion).toBe('v4');
    });
  });

  describe('when a string is provided and the global default provider is not set', () => {
    it('should return a gateway speech model', () => {
      const mockModel = new MockSpeechModelV4({
        provider: 'gateway',
        modelId: 'test-model-id',
      });

      const speechModelSpy = vi
        .spyOn(gateway, 'speechModel')
        .mockReturnValue(mockModel as any);

      try {
        const resolvedModel = resolveSpeechModel('test-model-id');

        expect(resolvedModel?.provider).toBe('gateway');
        expect(resolvedModel?.modelId).toBe('test-model-id');
      } finally {
        speechModelSpy.mockRestore();
      }
    });
  });

  describe('when a string is provided and the global default provider is set', () => {
    beforeEach(() => {
      globalThis.AI_SDK_DEFAULT_PROVIDER = customProvider({
        speechModels: {
          'test-model-id': new MockSpeechModelV4({
            provider: 'global-test-provider',
            modelId: 'actual-test-model-id',
          }),
        },
      });
    });

    afterEach(() => {
      delete globalThis.AI_SDK_DEFAULT_PROVIDER;
    });

    it('should return a speech model from the global default provider', () => {
      const resolvedModel = resolveSpeechModel('test-model-id');

      expect(resolvedModel?.provider).toBe('global-test-provider');
      expect(resolvedModel?.modelId).toBe('actual-test-model-id');
    });
  });

  describe('when a string is provided and the default provider does not support speech models', () => {
    beforeEach(() => {
      globalThis.AI_SDK_DEFAULT_PROVIDER = {
        specificationVersion: 'v4' as const,
        languageModel: () => {
          throw new Error('not implemented');
        },
        embeddingModel: () => {
          throw new Error('not implemented');
        },
        imageModel: () => {
          throw new Error('not implemented');
        },
      };
    });

    afterEach(() => {
      delete globalThis.AI_SDK_DEFAULT_PROVIDER;
    });

    it('should return undefined', () => {
      expect(resolveSpeechModel('test-model-id')).toBeUndefined();
    });
  });

  describe('when a model with unsupported specification version is provided', () => {
    it('should throw UnsupportedModelVersionError', () => {
      const unsupportedModel = {
        specificationVersion: 'v1',
        provider: 'test-provider',
        modelId: 'test-model-id',
      } as any;

      expect(() => resolveSpeechModel(unsupportedModel)).toThrow();
    });
  });
});

describe('resolveTranscriptionModel', () => {
  describe('when a transcription model v4 is provided', () => {
    it('should return it as-is', () => {
      const originalModel = new MockTranscriptionModelV4({
        provider: 'test-provider',
        modelId: 'test-model-id',
      });

      const resolvedModel = resolveTranscriptionModel(originalModel);

      expect(resolvedModel).toBe(originalModel);
      expect(resolvedModel?.specificationVersion).toBe('v4');
    });
  });

  describe('when a transcription model v3 is provided', () => {
    it('should convert v3 to v4', () => {
      const resolvedModel = resolveTranscriptionModel(
        new MockTranscriptionModelV3({
          provider: 'test-provider',
          modelId: 'test-model-id',
        }),
      );

      expect(resolvedModel?.provider).toBe('test-provider');
      expect(resolvedModel?.modelId).toBe('test-model-id');
      expect(resolvedModel?.specificationVersion).toBe('v4');
    });
  });

  describe('when a string is provided and the global default provider is not set', () => {
    it('should return a gateway transcription model', () => {
      const mockModel = new MockTranscriptionModelV4({
        provider: 'gateway',
        modelId: 'test-model-id',
      });

      const transcriptionModelSpy = vi
        .spyOn(gateway, 'transcriptionModel')
        .mockReturnValue(mockModel as any);

      try {
        const resolvedModel = resolveTranscriptionModel('test-model-id');

        expect(resolvedModel?.provider).toBe('gateway');
        expect(resolvedModel?.modelId).toBe('test-model-id');
      } finally {
        transcriptionModelSpy.mockRestore();
      }
    });
  });

  describe('when a string is provided and the global default provider is set', () => {
    beforeEach(() => {
      globalThis.AI_SDK_DEFAULT_PROVIDER = customProvider({
        transcriptionModels: {
          'test-model-id': new MockTranscriptionModelV4({
            provider: 'global-test-provider',
            modelId: 'actual-test-model-id',
          }),
        },
      });
    });

    afterEach(() => {
      delete globalThis.AI_SDK_DEFAULT_PROVIDER;
    });

    it('should return a transcription model from the global default provider', () => {
      const resolvedModel = resolveTranscriptionModel('test-model-id');

      expect(resolvedModel?.provider).toBe('global-test-provider');
      expect(resolvedModel?.modelId).toBe('actual-test-model-id');
    });
  });

  describe('when a string is provided and the default provider does not support transcription models', () => {
    beforeEach(() => {
      globalThis.AI_SDK_DEFAULT_PROVIDER = {
        specificationVersion: 'v4' as const,
        languageModel: () => {
          throw new Error('not implemented');
        },
        embeddingModel: () => {
          throw new Error('not implemented');
        },
        imageModel: () => {
          throw new Error('not implemented');
        },
      };
    });

    afterEach(() => {
      delete globalThis.AI_SDK_DEFAULT_PROVIDER;
    });

    it('should return undefined', () => {
      expect(resolveTranscriptionModel('test-model-id')).toBeUndefined();
    });
  });

  describe('when a model with unsupported specification version is provided', () => {
    it('should throw UnsupportedModelVersionError', () => {
      const unsupportedModel = {
        specificationVersion: 'v1',
        provider: 'test-provider',
        modelId: 'test-model-id',
      } as any;

      expect(() => resolveTranscriptionModel(unsupportedModel)).toThrow();
    });
  });
});

describe('resolveImageModel', () => {
  describe('when an image model v2 is provided', () => {
    it('should return the image model v2', () => {
      const resolvedModel = resolveImageModel(
        new MockImageModelV2({
          provider: 'test-provider',
          modelId: 'test-model-id',
        }),
      );

      expect(resolvedModel.provider).toBe('test-provider');
      expect(resolvedModel.modelId).toBe('test-model-id');
    });
  });

  describe('when a string is provided and the global default provider is not set', () => {
    it('should return a gateway image model', () => {
      const resolvedModel = resolveImageModel(
        new MockImageModelV2({
          provider: 'gateway',
          modelId: 'test-model-id',
        }),
      );

      // gateway.imageModel returns V3 types; cast needed until gateway is updated to V4
      const imageModelSpy = vi
        .spyOn(gateway, 'imageModel')
        .mockReturnValue(resolvedModel as any);

      try {
        const resolvedModel = resolveImageModel('test-model-id');

        expect(resolvedModel).toBe(resolvedModel);
      } finally {
        imageModelSpy.mockRestore();
      }
    });
  });

  describe('when a string is provided and the global default provider is set', () => {
    beforeEach(() => {
      globalThis.AI_SDK_DEFAULT_PROVIDER = customProvider({
        imageModels: {
          'test-model-id': resolveImageModel(
            new MockImageModelV2({
              provider: 'global-test-provider',
              modelId: 'actual-test-model-id',
            }),
          ),
        },
      });
    });

    afterEach(() => {
      delete globalThis.AI_SDK_DEFAULT_PROVIDER;
    });

    it('should return an image model from the global default provider', () => {
      const resolvedModel = resolveImageModel('test-model-id');

      expect(resolvedModel.provider).toBe('global-test-provider');
      expect(resolvedModel.modelId).toBe('actual-test-model-id');
    });
  });
});

describe('resolveVideoModel', () => {
  describe('when a video model v4 is provided', () => {
    it('should return it as-is', () => {
      const originalModel = new MockVideoModelV4({
        provider: 'test-provider',
        modelId: 'test-model-id',
      });

      const resolvedModel = resolveVideoModel(originalModel);

      expect(resolvedModel).toBe(originalModel);
      expect(resolvedModel.specificationVersion).toBe('v4');
    });
  });

  describe('when a video model v3 is provided', () => {
    it('should convert v3 to v4', () => {
      const resolvedModel = resolveVideoModel(
        new MockVideoModelV3({
          provider: 'test-provider',
          modelId: 'test-model-id',
        }),
      );

      expect(resolvedModel.provider).toBe('test-provider');
      expect(resolvedModel.modelId).toBe('test-model-id');
      expect(resolvedModel.specificationVersion).toBe('v4');
    });
  });

  describe('when a string is provided and the global default provider is not set', () => {
    it('should return a gateway video model converted to v4', () => {
      const mockModel = new MockVideoModelV4({
        provider: 'gateway',
        modelId: 'test-model-id',
      });

      // gateway.videoModel returns V3 types; cast needed until gateway is updated to V4
      const videoModelSpy = vi
        .spyOn(gateway, 'videoModel')
        .mockReturnValue(mockModel as any);

      try {
        const resolvedModel = resolveVideoModel('test-model-id');

        expect(resolvedModel.provider).toBe('gateway');
        expect(resolvedModel.modelId).toBe('test-model-id');
      } finally {
        videoModelSpy.mockRestore();
      }
    });
  });

  describe('when a string is provided and the global default provider is set', () => {
    beforeEach(() => {
      globalThis.AI_SDK_DEFAULT_PROVIDER = customProvider({
        videoModels: {
          'test-model-id': new MockVideoModelV4({
            provider: 'global-test-provider',
            modelId: 'actual-test-model-id',
          }),
        },
      });
    });

    afterEach(() => {
      delete globalThis.AI_SDK_DEFAULT_PROVIDER;
    });

    it('should return a video model from the global default provider', () => {
      const resolvedModel = resolveVideoModel('test-model-id');

      expect(resolvedModel.provider).toBe('global-test-provider');
      expect(resolvedModel.modelId).toBe('actual-test-model-id');
    });
  });

  describe('when a string is provided and the provider does not support video models', () => {
    beforeEach(() => {
      globalThis.AI_SDK_DEFAULT_PROVIDER = {
        specificationVersion: 'v4' as const,
        languageModel: () => {
          throw new Error('not implemented');
        },
        embeddingModel: () => {
          throw new Error('not implemented');
        },
        imageModel: () => {
          throw new Error('not implemented');
        },
      };
    });

    afterEach(() => {
      delete globalThis.AI_SDK_DEFAULT_PROVIDER;
    });

    it('should throw an error', () => {
      expect(() => resolveVideoModel('test-model-id')).toThrow(
        'The default provider does not support video models.',
      );
    });
  });

  describe('when a model with unsupported specification version is provided', () => {
    it('should throw UnsupportedModelVersionError', () => {
      const unsupportedModel = {
        specificationVersion: 'v1',
        provider: 'test-provider',
        modelId: 'test-model-id',
      } as any;

      expect(() => resolveVideoModel(unsupportedModel)).toThrow();
    });

    it('should throw UnsupportedModelVersionError for v2 models', () => {
      const v2Model = {
        specificationVersion: 'v2',
        provider: 'test-provider',
        modelId: 'test-model-id',
      } as any;

      expect(() => resolveVideoModel(v2Model)).toThrow();
    });
  });
});

describe('resolveRerankingModel', () => {
  describe('when a reranking model v4 is provided', () => {
    it('should return it as-is', () => {
      const originalModel = new MockRerankingModelV4({
        provider: 'test-provider',
        modelId: 'test-model-id',
      });

      const resolvedModel = resolveRerankingModel(originalModel);

      expect(resolvedModel).toBe(originalModel);
      expect(resolvedModel.specificationVersion).toBe('v4');
    });
  });

  describe('when a reranking model v3 is provided', () => {
    it('should convert v3 to v4', () => {
      const resolvedModel = resolveRerankingModel(
        new MockRerankingModelV3({
          provider: 'test-provider',
          modelId: 'test-model-id',
        }),
      );

      expect(resolvedModel.provider).toBe('test-provider');
      expect(resolvedModel.modelId).toBe('test-model-id');
      expect(resolvedModel.specificationVersion).toBe('v4');
    });
  });

  describe('when a string is provided and the global default provider is not set', () => {
    it('should return a gateway reranking model converted to v4', () => {
      const mockModel = new MockRerankingModelV4({
        provider: 'gateway',
        modelId: 'test-model-id',
      });

      const rerankingModelSpy = vi
        .spyOn(gateway, 'rerankingModel')
        .mockReturnValue(mockModel as any);

      try {
        const resolvedModel = resolveRerankingModel('test-model-id');

        expect(resolvedModel.provider).toBe('gateway');
        expect(resolvedModel.modelId).toBe('test-model-id');
      } finally {
        rerankingModelSpy.mockRestore();
      }
    });
  });

  describe('when a string is provided and the global default provider is set', () => {
    beforeEach(() => {
      globalThis.AI_SDK_DEFAULT_PROVIDER = customProvider({
        rerankingModels: {
          'test-model-id': new MockRerankingModelV4({
            provider: 'global-test-provider',
            modelId: 'actual-test-model-id',
          }),
        },
      });
    });

    afterEach(() => {
      delete globalThis.AI_SDK_DEFAULT_PROVIDER;
    });

    it('should return a reranking model from the global default provider', () => {
      const resolvedModel = resolveRerankingModel('test-model-id');

      expect(resolvedModel.provider).toBe('global-test-provider');
      expect(resolvedModel.modelId).toBe('actual-test-model-id');
    });
  });

  describe('when a string is provided and the provider does not support reranking models', () => {
    beforeEach(() => {
      globalThis.AI_SDK_DEFAULT_PROVIDER = {
        specificationVersion: 'v4' as const,
        languageModel: () => {
          throw new Error('not implemented');
        },
        embeddingModel: () => {
          throw new Error('not implemented');
        },
        imageModel: () => {
          throw new Error('not implemented');
        },
      };
    });

    afterEach(() => {
      delete globalThis.AI_SDK_DEFAULT_PROVIDER;
    });

    it('should throw an error', () => {
      expect(() => resolveRerankingModel('test-model-id')).toThrow(
        'The default provider does not support reranking models.',
      );
    });
  });

  describe('when a model with unsupported specification version is provided', () => {
    it('should throw UnsupportedModelVersionError', () => {
      const unsupportedModel = {
        specificationVersion: 'v1',
        provider: 'test-provider',
        modelId: 'test-model-id',
      } as any;

      expect(() => resolveRerankingModel(unsupportedModel)).toThrow();
    });

    it('should throw UnsupportedModelVersionError for v2 models', () => {
      const v2Model = {
        specificationVersion: 'v2',
        provider: 'test-provider',
        modelId: 'test-model-id',
      } as any;

      expect(() => resolveRerankingModel(v2Model)).toThrow();
    });
  });
});
