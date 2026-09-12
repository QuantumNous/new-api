import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MockEmbeddingModelV2 } from '../test/mock-embedding-model-v2';
import { MockEmbeddingModelV3 } from '../test/mock-embedding-model-v3';
import {
  NoSuchModelError,
  type FilesV4,
  type SkillsV4,
} from '@ai-sdk/provider';
import { MockEmbeddingModelV4 } from '../test/mock-embedding-model-v4';
import { MockImageModelV2 } from '../test/mock-image-model-v2';
import { MockImageModelV3 } from '../test/mock-image-model-v3';
import { MockImageModelV4 } from '../test/mock-image-model-v4';
import { MockLanguageModelV2 } from '../test/mock-language-model-v2';
import { MockLanguageModelV3 } from '../test/mock-language-model-v3';
import { MockLanguageModelV4 } from '../test/mock-language-model-v4';
import { MockProviderV2 } from '../test/mock-provider-v2';
import { MockProviderV3 } from '../test/mock-provider-v3';
import { MockRerankingModelV3 } from '../test/mock-reranking-model-v3';
import { MockRerankingModelV4 } from '../test/mock-reranking-model-v4';
import { MockSpeechModelV2 } from '../test/mock-speech-model-v2';
import { MockSpeechModelV3 } from '../test/mock-speech-model-v3';
import { MockSpeechModelV4 } from '../test/mock-speech-model-v4';
import { MockTranscriptionModelV2 } from '../test/mock-transcription-model-v2';
import { MockTranscriptionModelV3 } from '../test/mock-transcription-model-v3';
import { MockTranscriptionModelV4 } from '../test/mock-transcription-model-v4';
import { MockVideoModelV3 } from '../test/mock-video-model-v3';
import { MockVideoModelV4 } from '../test/mock-video-model-v4';
import { customProvider } from './custom-provider';

const mockLanguageModel = new MockLanguageModelV4();
const mockEmbeddingModel = new MockEmbeddingModelV4();
const mockRerankingModel = new MockRerankingModelV4();
const mockFiles: FilesV4 = {
  specificationVersion: 'v4',
  provider: 'mock-provider',
  uploadFile: vi.fn(),
};
const mockSkills: SkillsV4 = {
  specificationVersion: 'v4',
  provider: 'mock-provider',
  uploadSkill: vi.fn(),
};
const mockFallbackProvider = {
  specificationVersion: 'v4' as const,
  languageModel: vi.fn(),
  embeddingModel: vi.fn(),
  imageModel: vi.fn(),
  transcriptionModel: vi.fn(),
  speechModel: vi.fn(),
  rerankingModel: vi.fn(),
  videoModel: vi.fn(),
};

describe('languageModel', () => {
  it('should return the language model if it exists', () => {
    const provider = customProvider({
      languageModels: { 'test-model': mockLanguageModel },
    });

    expect(provider.languageModel('test-model')).toBe(mockLanguageModel);
  });

  it('should convert v2 and v3 language models to v4 on demand', () => {
    const provider = customProvider({
      languageModels: {
        'v2-model': new MockLanguageModelV2(),
        'v3-model': new MockLanguageModelV3(),
      },
    });

    expect(provider.languageModel('v2-model').specificationVersion).toBe('v4');
    expect(provider.languageModel('v3-model').specificationVersion).toBe('v4');
  });

  it('should use fallback provider if model not found and fallback exists', () => {
    mockFallbackProvider.languageModel.mockReturnValue(mockLanguageModel);

    const provider = customProvider({
      fallbackProvider: mockFallbackProvider,
    });

    expect(provider.languageModel('test-model')).toBe(mockLanguageModel);
    expect(mockFallbackProvider.languageModel).toHaveBeenCalledWith(
      'test-model',
    );
  });

  it('should convert v2 fallback provider language models to v4', () => {
    const provider = customProvider({
      fallbackProvider: new MockProviderV2({
        languageModels: { 'test-model': new MockLanguageModelV2() },
      }),
    });

    expect(provider.languageModel('test-model').specificationVersion).toBe(
      'v4',
    );
  });

  it('should convert v3 fallback provider language models to v4', () => {
    const provider = customProvider({
      fallbackProvider: new MockProviderV3({
        languageModels: { 'test-model': new MockLanguageModelV3() },
      }),
    });

    expect(provider.languageModel('test-model').specificationVersion).toBe(
      'v4',
    );
  });

  it('should throw NoSuchModelError if model not found and no fallback', () => {
    const provider = customProvider({});
    expect(() => provider.languageModel('test-model')).toThrow(
      NoSuchModelError,
    );
  });
});

describe('string model ids', () => {
  const languageModel = new MockLanguageModelV4();
  const embeddingModel = new MockEmbeddingModelV4();
  const imageModel = new MockImageModelV4();
  const transcriptionModel = new MockTranscriptionModelV4();
  const speechModel = new MockSpeechModelV4();
  const rerankingModel = new MockRerankingModelV4();
  const videoModel = new MockVideoModelV4();

  beforeEach(() => {
    globalThis.AI_SDK_DEFAULT_PROVIDER = customProvider({
      languageModels: { language: languageModel },
      embeddingModels: { embedding: embeddingModel },
      imageModels: { image: imageModel },
      transcriptionModels: { transcription: transcriptionModel },
      speechModels: { speech: speechModel },
      rerankingModels: { reranking: rerankingModel },
      videoModels: { video: videoModel },
    });
  });

  afterEach(() => {
    delete globalThis.AI_SDK_DEFAULT_PROVIDER;
  });

  it('should resolve string model ids through the global default provider', () => {
    const provider = customProvider({
      languageModels: { alias: 'language' },
      embeddingModels: { alias: 'embedding' },
      imageModels: { alias: 'image' },
      transcriptionModels: { alias: 'transcription' },
      speechModels: { alias: 'speech' },
      rerankingModels: { alias: 'reranking' },
      videoModels: { alias: 'video' },
    });

    expect(provider.languageModel('alias')).toBe(languageModel);
    expect(provider.embeddingModel('alias')).toBe(embeddingModel);
    expect(provider.imageModel('alias')).toBe(imageModel);
    expect(provider.transcriptionModel('alias')).toBe(transcriptionModel);
    expect(provider.speechModel('alias')).toBe(speechModel);
    expect(provider.rerankingModel('alias')).toBe(rerankingModel);
    expect(provider.videoModel('alias')).toBe(videoModel);
  });
});

describe('embeddingModel', () => {
  it('should return the embedding model if it exists', () => {
    const provider = customProvider({
      embeddingModels: { 'test-model': mockEmbeddingModel },
    });

    expect(provider.embeddingModel('test-model')).toBe(mockEmbeddingModel);
  });

  it('should convert v2 and v3 embedding models to v4 on demand', () => {
    const provider = customProvider({
      embeddingModels: {
        'v2-model': new MockEmbeddingModelV2<string>(),
        'v3-model': new MockEmbeddingModelV3(),
      },
    });

    expect(provider.embeddingModel('v2-model').specificationVersion).toBe('v4');
    expect(provider.embeddingModel('v3-model').specificationVersion).toBe('v4');
  });

  it('should use fallback provider if model not found and fallback exists', () => {
    mockFallbackProvider.embeddingModel.mockReturnValue(mockEmbeddingModel);

    const provider = customProvider({
      fallbackProvider: mockFallbackProvider,
    });

    expect(provider.embeddingModel('test-model')).toBe(mockEmbeddingModel);
    expect(mockFallbackProvider.embeddingModel).toHaveBeenCalledWith(
      'test-model',
    );
  });

  it('should throw NoSuchModelError if model not found and no fallback', () => {
    const provider = customProvider({});

    expect(() => provider.embeddingModel('test-model')).toThrow(
      NoSuchModelError,
    );
  });
});

describe('imageModel', () => {
  const mockImageModel = new MockImageModelV4();

  it('should return the image model if it exists', () => {
    const provider = customProvider({
      imageModels: { 'test-model': mockImageModel },
    });

    expect(provider.imageModel('test-model')).toBe(mockImageModel);
  });

  it('should convert v2 and v3 image models to v4 on demand', () => {
    const provider = customProvider({
      imageModels: {
        'v2-model': new MockImageModelV2(),
        'v3-model': new MockImageModelV3(),
      },
    });

    expect(provider.imageModel('v2-model').specificationVersion).toBe('v4');
    expect(provider.imageModel('v3-model').specificationVersion).toBe('v4');
  });

  it('should use fallback provider if model not found and fallback exists', () => {
    mockFallbackProvider.imageModel = vi.fn().mockReturnValue(mockImageModel);

    const provider = customProvider({
      fallbackProvider: mockFallbackProvider,
    });

    expect(provider.imageModel('test-model')).toBe(mockImageModel);
    expect(mockFallbackProvider.imageModel).toHaveBeenCalledWith('test-model');
  });

  it('should throw NoSuchModelError if model not found and no fallback', () => {
    const provider = customProvider({});

    expect(() => provider.imageModel('test-model')).toThrow(NoSuchModelError);
  });
});

describe('transcriptionModel', () => {
  const mockTranscriptionModel = new MockTranscriptionModelV4();

  it('should return the transcription model if it exists', () => {
    const provider = customProvider({
      transcriptionModels: { 'test-model': mockTranscriptionModel },
    });

    expect(provider.transcriptionModel('test-model')).toBe(
      mockTranscriptionModel,
    );
  });

  it('should convert v2 and v3 transcription models to v4 on demand', () => {
    const provider = customProvider({
      transcriptionModels: {
        'v2-model': new MockTranscriptionModelV2(),
        'v3-model': new MockTranscriptionModelV3(),
      },
    });

    expect(provider.transcriptionModel('v2-model').specificationVersion).toBe(
      'v4',
    );
    expect(provider.transcriptionModel('v3-model').specificationVersion).toBe(
      'v4',
    );
  });

  it('should use fallback provider if model not found and fallback exists', () => {
    mockFallbackProvider.transcriptionModel = vi
      .fn()
      .mockReturnValue(mockTranscriptionModel);

    const provider = customProvider({
      fallbackProvider: mockFallbackProvider,
    });

    expect(provider.transcriptionModel('test-model')).toBe(
      mockTranscriptionModel,
    );
    expect(mockFallbackProvider.transcriptionModel).toHaveBeenCalledWith(
      'test-model',
    );
  });

  it('should throw NoSuchModelError if model not found and no fallback', () => {
    const provider = customProvider({});

    expect(() => provider.transcriptionModel('test-model')).toThrow(
      NoSuchModelError,
    );
  });
});

describe('speechModel', () => {
  const mockSpeechModel = new MockSpeechModelV4();

  it('should return the speech model if it exists', () => {
    const provider = customProvider({
      speechModels: { 'test-model': mockSpeechModel },
    });

    expect(provider.speechModel('test-model')).toBe(mockSpeechModel);
  });

  it('should convert v2 and v3 speech models to v4 on demand', () => {
    const provider = customProvider({
      speechModels: {
        'v2-model': new MockSpeechModelV2(),
        'v3-model': new MockSpeechModelV3(),
      },
    });

    expect(provider.speechModel('v2-model').specificationVersion).toBe('v4');
    expect(provider.speechModel('v3-model').specificationVersion).toBe('v4');
  });

  it('should use fallback provider if model not found and fallback exists', () => {
    mockFallbackProvider.speechModel = vi.fn().mockReturnValue(mockSpeechModel);

    const provider = customProvider({
      fallbackProvider: mockFallbackProvider,
    });

    expect(provider.speechModel('test-model')).toBe(mockSpeechModel);
    expect(mockFallbackProvider.speechModel).toHaveBeenCalledWith('test-model');
  });

  it('should throw NoSuchModelError if model not found and no fallback', () => {
    const provider = customProvider({});

    expect(() => provider.speechModel('test-model')).toThrow(NoSuchModelError);
  });
});

describe('rerankingModel', () => {
  it('should return the reranking model if it exists', () => {
    const provider = customProvider({
      rerankingModels: { 'test-model': mockRerankingModel },
    });

    expect(provider.rerankingModel('test-model')).toBe(mockRerankingModel);
  });

  it('should convert v3 reranking models to v4 on demand', () => {
    const provider = customProvider({
      rerankingModels: { 'v3-model': new MockRerankingModelV3() },
    });

    expect(provider.rerankingModel('v3-model').specificationVersion).toBe('v4');
  });

  it('should use fallback provider if model not found and fallback exists', () => {
    mockFallbackProvider.rerankingModel.mockReturnValue(mockRerankingModel);

    const provider = customProvider({
      fallbackProvider: mockFallbackProvider,
    });

    expect(provider.rerankingModel('test-model')).toBe(mockRerankingModel);
    expect(mockFallbackProvider.rerankingModel).toHaveBeenCalledWith(
      'test-model',
    );
  });

  it('should throw NoSuchModelError if model not found and no fallback', () => {
    const provider = customProvider({});

    expect(() => provider.rerankingModel('test-model')).toThrow(
      NoSuchModelError,
    );
  });
});

describe('videoModel', () => {
  const mockVideoModel = new MockVideoModelV4();

  it('should return the video model if it exists', () => {
    const provider = customProvider({
      videoModels: { 'test-model': mockVideoModel },
    });

    expect(provider.videoModel('test-model')).toBe(mockVideoModel);
  });

  it('should convert v3 video models to v4 on demand', () => {
    const provider = customProvider({
      videoModels: { 'v3-model': new MockVideoModelV3() },
    });

    expect(provider.videoModel('v3-model').specificationVersion).toBe('v4');
  });

  it('should use fallback provider if model not found and fallback exists', () => {
    mockFallbackProvider.videoModel = vi.fn().mockReturnValue(mockVideoModel);

    const provider = customProvider({
      fallbackProvider: mockFallbackProvider,
    });

    expect(provider.videoModel('test-model')).toBe(mockVideoModel);
    expect(mockFallbackProvider.videoModel).toHaveBeenCalledWith('test-model');
  });

  it('should throw NoSuchModelError if model not found and no fallback', () => {
    const provider = customProvider({});

    expect(() => provider.videoModel('test-model')).toThrow(NoSuchModelError);
  });
});

describe('files', () => {
  it('should return the files interface if it exists', () => {
    const provider = customProvider({
      files: mockFiles,
    });

    expect(provider.files()).toBe(mockFiles);
  });

  it('should use fallback provider files if files is not configured and fallback exists', () => {
    const fallbackProvider = {
      ...mockFallbackProvider,
      files: vi.fn().mockReturnValue(mockFiles),
    };

    const provider = customProvider({
      fallbackProvider,
    });

    expect(provider.files()).toBe(mockFiles);
    expect(fallbackProvider.files).toHaveBeenCalled();
  });

  it('should not expose files if files is not configured and fallback does not support files', () => {
    const provider = customProvider({});

    expect(provider.files).toBeUndefined();
  });
});

describe('skills', () => {
  it('should return the skills interface if it exists', () => {
    const provider = customProvider({
      skills: mockSkills,
    });

    expect(provider.skills()).toBe(mockSkills);
  });

  it('should use fallback provider skills if skills is not configured and fallback exists', () => {
    const fallbackProvider = {
      ...mockFallbackProvider,
      skills: vi.fn().mockReturnValue(mockSkills),
    };

    const provider = customProvider({
      fallbackProvider,
    });

    expect(provider.skills()).toBe(mockSkills);
    expect(fallbackProvider.skills).toHaveBeenCalled();
  });

  it('should not expose skills if skills is not configured and fallback does not support skills', () => {
    const provider = customProvider({});

    expect(provider.skills).toBeUndefined();
  });
});
