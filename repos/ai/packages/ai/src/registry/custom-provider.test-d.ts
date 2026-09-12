import type {
  EmbeddingModelV4,
  Experimental_VideoModelV4,
  FilesV4,
  ImageModelV4,
  LanguageModelV4,
  ProviderV4,
  RerankingModelV4,
  SkillsV4,
  SpeechModelV4,
  TranscriptionModelV4,
} from '@ai-sdk/provider';
import { describe, expectTypeOf, it } from 'vitest';
import { customProvider } from './custom-provider';
import { MockEmbeddingModelV2 } from '../test/mock-embedding-model-v2';
import { MockEmbeddingModelV3 } from '../test/mock-embedding-model-v3';
import { MockEmbeddingModelV4 } from '../test/mock-embedding-model-v4';
import { MockImageModelV2 } from '../test/mock-image-model-v2';
import { MockImageModelV3 } from '../test/mock-image-model-v3';
import { MockImageModelV4 } from '../test/mock-image-model-v4';
import { MockLanguageModelV2 } from '../test/mock-language-model-v2';
import { MockLanguageModelV3 } from '../test/mock-language-model-v3';
import { MockLanguageModelV4 } from '../test/mock-language-model-v4';
import { MockProviderV4 } from '../test/mock-provider-v4';
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

/**
 * Type-level tests for `customProvider`. Literal model identifiers follow the private
 * `ExtractModelId` helper in `custom-provider.ts` (string keys of each model record).
 */

describe('customProvider autocomplete / literal model identifiers', () => {
  const languageModel = new MockLanguageModelV4();
  const embeddingModel = new MockEmbeddingModelV4();
  const imageModel = new MockImageModelV4();
  const transcriptionModel = new MockTranscriptionModelV4();
  const speechModel = new MockSpeechModelV4();
  const rerankingModel = new MockRerankingModelV4();
  const videoModel = new MockVideoModelV4();

  const provider = customProvider({
    languageModels: {
      opus: languageModel,
      sonnet: languageModel,
      haiku: languageModel,
    },
    embeddingModels: {
      small: embeddingModel,
      large: embeddingModel,
    },
    imageModels: {
      photon: imageModel,
    },
    transcriptionModels: {
      'whisper-1': transcriptionModel,
    },
    speechModels: {
      tts1: speechModel,
    },
    rerankingModels: {
      rerank: rerankingModel,
    },
    videoModels: {
      'preview-video': videoModel,
    },
  });

  it('narrows languageModel identifiers to the configured languageModels keys', () => {
    type InferredLanguageModelIdentifier = Parameters<
      (typeof provider)['languageModel']
    >[0];

    expectTypeOf<InferredLanguageModelIdentifier>().toEqualTypeOf<
      'opus' | 'sonnet' | 'haiku'
    >();

    expectTypeOf(
      provider.languageModel('haiku'),
    ).toEqualTypeOf<LanguageModelV4>();
    expectTypeOf(
      provider.languageModel('opus'),
    ).toEqualTypeOf<LanguageModelV4>();

    expectTypeOf<'sonnet'>().toMatchTypeOf<InferredLanguageModelIdentifier>();
    expectTypeOf<InferredLanguageModelIdentifier>().not.toMatchTypeOf<'gpt-5'>();
    expectTypeOf<InferredLanguageModelIdentifier>().not.toMatchTypeOf<'typo'>();
  });

  it('narrows embeddingModel, imageModel, and other accessors to their record keys', () => {
    type InferredEmbeddingIdentifier = Parameters<
      (typeof provider)['embeddingModel']
    >[0];
    type InferredImageIdentifier = Parameters<
      (typeof provider)['imageModel']
    >[0];
    type InferredTranscriptionIdentifier = Parameters<
      (typeof provider)['transcriptionModel']
    >[0];
    type InferredSpeechIdentifier = Parameters<
      (typeof provider)['speechModel']
    >[0];
    type InferredRerankingIdentifier = Parameters<
      (typeof provider)['rerankingModel']
    >[0];
    type InferredVideoIdentifier = Parameters<
      (typeof provider)['videoModel']
    >[0];

    expectTypeOf<InferredEmbeddingIdentifier>().toEqualTypeOf<
      'small' | 'large'
    >();
    expectTypeOf<InferredImageIdentifier>().toEqualTypeOf<'photon'>();
    expectTypeOf<InferredTranscriptionIdentifier>().toEqualTypeOf<'whisper-1'>();
    expectTypeOf<InferredSpeechIdentifier>().toEqualTypeOf<'tts1'>();
    expectTypeOf<InferredRerankingIdentifier>().toEqualTypeOf<'rerank'>();
    expectTypeOf<InferredVideoIdentifier>().toEqualTypeOf<'preview-video'>();

    expectTypeOf(
      provider.embeddingModel('small'),
    ).toEqualTypeOf<EmbeddingModelV4>();
    expectTypeOf(provider.imageModel('photon')).toEqualTypeOf<ImageModelV4>();
    expectTypeOf(
      provider.transcriptionModel('whisper-1'),
    ).toEqualTypeOf<TranscriptionModelV4>();
    expectTypeOf(provider.speechModel('tts1')).toEqualTypeOf<SpeechModelV4>();
    expectTypeOf(
      provider.rerankingModel('rerank'),
    ).toEqualTypeOf<RerankingModelV4>();
    expectTypeOf(
      provider.videoModel('preview-video'),
    ).toEqualTypeOf<Experimental_VideoModelV4>();

    expectTypeOf<InferredEmbeddingIdentifier>().not.toMatchTypeOf<'wrong-key'>();
  });

  it('satisfies ProviderV4 so the instance is assignable where a provider is required', () => {
    expectTypeOf(provider).toMatchTypeOf<ProviderV4>();
  });

  it('uses hyphenated and dotted keys in the literal unions', () => {
    const hyphenProvider = customProvider({
      languageModels: {
        'gpt-4o-high-reasoning': languageModel,
        'claude-3-5-sonnet': languageModel,
      },
    });

    type HyphenLanguageIdentifiers = Parameters<
      (typeof hyphenProvider)['languageModel']
    >[0];

    expectTypeOf<HyphenLanguageIdentifiers>().toEqualTypeOf<
      'gpt-4o-high-reasoning' | 'claude-3-5-sonnet'
    >();
  });
});

describe('customProvider with older model versions', () => {
  it('accepts v2 and v3 models while returning v4 models', () => {
    const provider = customProvider({
      languageModels: {
        'language-v2': new MockLanguageModelV2(),
        'language-v3': new MockLanguageModelV3(),
      },
      embeddingModels: {
        'embedding-v2': new MockEmbeddingModelV2<string>(),
        'embedding-v3': new MockEmbeddingModelV3(),
      },
      imageModels: {
        'image-v2': new MockImageModelV2(),
        'image-v3': new MockImageModelV3(),
      },
      transcriptionModels: {
        'transcription-v2': new MockTranscriptionModelV2(),
        'transcription-v3': new MockTranscriptionModelV3(),
      },
      speechModels: {
        'speech-v2': new MockSpeechModelV2(),
        'speech-v3': new MockSpeechModelV3(),
      },
      rerankingModels: {
        'reranking-v3': new MockRerankingModelV3(),
      },
      videoModels: {
        'video-v3': new MockVideoModelV3(),
      },
    });

    type InferredLanguageIdentifier = Parameters<
      (typeof provider)['languageModel']
    >[0];
    type InferredEmbeddingIdentifier = Parameters<
      (typeof provider)['embeddingModel']
    >[0];

    expectTypeOf<InferredLanguageIdentifier>().toEqualTypeOf<
      'language-v2' | 'language-v3'
    >();
    expectTypeOf<InferredEmbeddingIdentifier>().toEqualTypeOf<
      'embedding-v2' | 'embedding-v3'
    >();

    expectTypeOf(
      provider.languageModel('language-v2'),
    ).toEqualTypeOf<LanguageModelV4>();
    expectTypeOf(
      provider.languageModel('language-v3'),
    ).toEqualTypeOf<LanguageModelV4>();
    expectTypeOf(
      provider.embeddingModel('embedding-v2'),
    ).toEqualTypeOf<EmbeddingModelV4>();
    expectTypeOf(
      provider.embeddingModel('embedding-v3'),
    ).toEqualTypeOf<EmbeddingModelV4>();
    expectTypeOf(provider.imageModel('image-v2')).toEqualTypeOf<ImageModelV4>();
    expectTypeOf(provider.imageModel('image-v3')).toEqualTypeOf<ImageModelV4>();
    expectTypeOf(
      provider.transcriptionModel('transcription-v2'),
    ).toEqualTypeOf<TranscriptionModelV4>();
    expectTypeOf(
      provider.transcriptionModel('transcription-v3'),
    ).toEqualTypeOf<TranscriptionModelV4>();
    expectTypeOf(
      provider.speechModel('speech-v2'),
    ).toEqualTypeOf<SpeechModelV4>();
    expectTypeOf(
      provider.speechModel('speech-v3'),
    ).toEqualTypeOf<SpeechModelV4>();
    expectTypeOf(
      provider.rerankingModel('reranking-v3'),
    ).toEqualTypeOf<RerankingModelV4>();
    expectTypeOf(
      provider.videoModel('video-v3'),
    ).toEqualTypeOf<Experimental_VideoModelV4>();
  });
});

describe('customProvider with string model ids', () => {
  it('accepts string model ids while returning v4 models', () => {
    const provider = customProvider({
      languageModels: {
        gateway: 'openai/gpt-5',
      },
      embeddingModels: {
        embedding: 'embedding-model-id',
      },
      imageModels: {
        image: 'image-model-id',
      },
      transcriptionModels: {
        transcription: 'transcription-model-id',
      },
      speechModels: {
        speech: 'speech-model-id',
      },
      rerankingModels: {
        reranking: 'reranking-model-id',
      },
      videoModels: {
        video: 'video-model-id',
      },
    });

    expectTypeOf(
      provider.languageModel('gateway'),
    ).toEqualTypeOf<LanguageModelV4>();
    expectTypeOf(
      provider.embeddingModel('embedding'),
    ).toEqualTypeOf<EmbeddingModelV4>();
    expectTypeOf(provider.imageModel('image')).toEqualTypeOf<ImageModelV4>();
    expectTypeOf(
      provider.transcriptionModel('transcription'),
    ).toEqualTypeOf<TranscriptionModelV4>();
    expectTypeOf(provider.speechModel('speech')).toEqualTypeOf<SpeechModelV4>();
    expectTypeOf(
      provider.rerankingModel('reranking'),
    ).toEqualTypeOf<RerankingModelV4>();
    expectTypeOf(
      provider.videoModel('video'),
    ).toEqualTypeOf<Experimental_VideoModelV4>();
  });
});

describe('customProvider with files and skills', () => {
  const files: FilesV4 = {
    specificationVersion: 'v4',
    provider: 'mock-provider',
    uploadFile: async () => ({
      providerReference: { 'mock-provider': 'file-123' },
      warnings: [],
    }),
  };
  const skills: SkillsV4 = {
    specificationVersion: 'v4',
    provider: 'mock-provider',
    uploadSkill: async () => ({
      providerReference: { 'mock-provider': 'skill-123' },
      warnings: [],
    }),
  };

  it('exposes required files and skills methods when configured', () => {
    const provider = customProvider({
      files,
      skills,
    });

    expectTypeOf(provider.files).toEqualTypeOf<() => FilesV4>();
    expectTypeOf(provider.skills).toEqualTypeOf<() => SkillsV4>();
    expectTypeOf(provider.files()).toEqualTypeOf<FilesV4>();
    expectTypeOf(provider.skills()).toEqualTypeOf<SkillsV4>();
    expectTypeOf(provider).toMatchTypeOf<ProviderV4>();
  });

  it('keeps files and skills methods optional when not configured', () => {
    const provider = customProvider({});

    expectTypeOf(provider.files).toMatchTypeOf<ProviderV4['files']>();
    expectTypeOf(provider.skills).toMatchTypeOf<ProviderV4['skills']>();
  });

  it('exposes required files and skills when fallback provider declares them as required', () => {
    const fallbackWithFilesAndSkills = {
      ...new MockProviderV4(),
      files: (): FilesV4 => files,
      skills: (): SkillsV4 => skills,
    };

    const provider = customProvider({
      fallbackProvider: fallbackWithFilesAndSkills,
    });

    expectTypeOf(provider.files).toEqualTypeOf<() => FilesV4>();
    expectTypeOf(provider.skills).toEqualTypeOf<() => SkillsV4>();
    expectTypeOf(provider.files()).toEqualTypeOf<FilesV4>();
    expectTypeOf(provider.skills()).toEqualTypeOf<SkillsV4>();
  });

  it('exposes required files when only fallback declares files', () => {
    const fallbackWithFiles = {
      ...new MockProviderV4(),
      files: (): FilesV4 => files,
    };

    const provider = customProvider({
      fallbackProvider: fallbackWithFiles,
    });

    expectTypeOf(provider.files).toEqualTypeOf<() => FilesV4>();
    expectTypeOf(provider.skills).toMatchTypeOf<ProviderV4['skills']>();
  });

  it('exposes required skills when only fallback declares skills', () => {
    const fallbackWithSkills = {
      ...new MockProviderV4(),
      skills: (): SkillsV4 => skills,
    };

    const provider = customProvider({
      fallbackProvider: fallbackWithSkills,
    });

    expectTypeOf(provider.files).toMatchTypeOf<ProviderV4['files']>();
    expectTypeOf(provider.skills).toEqualTypeOf<() => SkillsV4>();
  });

  it('keeps files and skills optional when fallback is a plain ProviderV4 (optional methods)', () => {
    const provider = customProvider({
      fallbackProvider: new MockProviderV4(),
    });

    expectTypeOf(provider.files).toMatchTypeOf<ProviderV4['files']>();
    expectTypeOf(provider.skills).toMatchTypeOf<ProviderV4['skills']>();
  });

  it('keeps files and skills optional when fallback is a v2 or v3 provider', () => {
    const v2Provider = customProvider({
      fallbackProvider: new MockProviderV2({}),
    });
    const v3Provider = customProvider({
      fallbackProvider: new MockProviderV3({}),
    });

    expectTypeOf(v2Provider.files).toMatchTypeOf<ProviderV4['files']>();
    expectTypeOf(v2Provider.skills).toMatchTypeOf<ProviderV4['skills']>();
    expectTypeOf(v3Provider.files).toMatchTypeOf<ProviderV4['files']>();
    expectTypeOf(v3Provider.skills).toMatchTypeOf<ProviderV4['skills']>();
  });

  it('keeps configured files/skills required even when combined with a fallback that lacks them', () => {
    const provider = customProvider({
      files,
      skills,
      fallbackProvider: new MockProviderV4(),
    });

    expectTypeOf(provider.files).toEqualTypeOf<() => FilesV4>();
    expectTypeOf(provider.skills).toEqualTypeOf<() => SkillsV4>();
  });
});

describe('customProvider negative typing', () => {
  const languageModel = new MockLanguageModelV4();

  it('rejects identifiers that are not keys on the corresponding record (assignability)', () => {
    const narrowProvider = customProvider({
      languageModels: { haiku: languageModel },
    });

    type ConfiguredLanguageModelIdentifier = Parameters<
      (typeof narrowProvider)['languageModel']
    >[0];

    expectTypeOf<ConfiguredLanguageModelIdentifier>().toEqualTypeOf<'haiku'>();

    // `customProvider` returns `ProviderV4 & { ... narrow methods ... }`. Method parameters
    // in intersections are checked bivariantly for direct calls, so invalid literals may
    // still type-check on `narrowProvider.languageModel('opus')`. Assigning to the
    // parameter type catches the intended rejection.
    // @ts-expect-error opus is not a key in languageModels
    const _wrongLanguageIdentifier: ConfiguredLanguageModelIdentifier = 'opus';
  });

  it('uses string for embeddingModel identifiers when embeddingModels is not configured', () => {
    const languageOnlyProvider = customProvider({
      languageModels: { haiku: languageModel },
    });

    type EmbeddingIdentifierWhenUnconfigured = Parameters<
      (typeof languageOnlyProvider)['embeddingModel']
    >[0];

    expectTypeOf<EmbeddingIdentifierWhenUnconfigured>().toEqualTypeOf<string>();
  });

  it('rejects wrong embedding and image identifiers for a fully configured provider', () => {
    const configuredProvider = customProvider({
      languageModels: { haiku: languageModel },
      embeddingModels: { small: new MockEmbeddingModelV4() },
      imageModels: { photon: new MockImageModelV4() },
    });

    type EmbeddingIdentifier = Parameters<
      (typeof configuredProvider)['embeddingModel']
    >[0];
    type ImageIdentifier = Parameters<
      (typeof configuredProvider)['imageModel']
    >[0];

    // @ts-expect-error typo is not a configured embedding model id
    const _wrongEmbeddingIdentifier: EmbeddingIdentifier = 'typo';
    // @ts-expect-error typo is not a configured image model id
    const _wrongImageIdentifier: ImageIdentifier = 'typo';
  });
});

describe('customProvider with fallback provider typing', () => {
  const languageModel = new MockLanguageModelV4();

  const fallbackProvider = new MockProviderV4({
    languageModels: { 'fallback-language': languageModel },
    embeddingModels: { 'fallback-embedding': new MockEmbeddingModelV4() },
  });

  it('narrows languageModel identifiers to configured keys; fallback-only ids are not in the union', () => {
    const provider = customProvider({
      languageModels: { alias: languageModel },
      fallbackProvider,
    });

    type LanguageIdentifiers = Parameters<
      (typeof provider)['languageModel']
    >[0];

    expectTypeOf<LanguageIdentifiers>().toEqualTypeOf<'alias'>();

    provider.languageModel('alias');

    // @ts-expect-error identifiers resolved only via fallback are not part of ExtractModelId
    const _fallbackOnlyIdentifier: LanguageIdentifiers = 'fallback-language';
  });

  it('accepts v2 and v3 fallback providers', () => {
    const providerWithV2Fallback = customProvider({
      fallbackProvider: new MockProviderV2({
        languageModels: { 'fallback-language': new MockLanguageModelV2() },
      }),
    });

    const providerWithV3Fallback = customProvider({
      fallbackProvider: new MockProviderV3({
        languageModels: { 'fallback-language': new MockLanguageModelV3() },
      }),
    });

    expectTypeOf(providerWithV2Fallback).toMatchTypeOf<ProviderV4>();
    expectTypeOf(providerWithV3Fallback).toMatchTypeOf<ProviderV4>();
    expectTypeOf(
      providerWithV2Fallback.languageModel('fallback-language'),
    ).toEqualTypeOf<LanguageModelV4>();
    expectTypeOf(
      providerWithV3Fallback.languageModel('fallback-language'),
    ).toEqualTypeOf<LanguageModelV4>();
  });
});
