import type {
  EmbeddingModelV4,
  Experimental_VideoModelV4,
  FilesV4,
  ImageModelV4,
  LanguageModelV4,
  ProviderV3,
  ProviderV4,
  RerankingModelV4,
  SkillsV4,
  SpeechModelV4,
  TranscriptionModelV4,
} from '@ai-sdk/provider';
import { describe, expectTypeOf, it } from 'vitest';
import type { ExtractLiteralUnion } from '../util/extract-literal-union';
import { customProvider } from './custom-provider';
import {
  createProviderRegistry,
  type ProviderRegistryProvider,
} from './provider-registry';
import { MockEmbeddingModelV3 } from '../test/mock-embedding-model-v3';
import { MockEmbeddingModelV4 } from '../test/mock-embedding-model-v4';
import { MockImageModelV3 } from '../test/mock-image-model-v3';
import { MockImageModelV4 } from '../test/mock-image-model-v4';
import { MockLanguageModelV3 } from '../test/mock-language-model-v3';
import { MockLanguageModelV4 } from '../test/mock-language-model-v4';
import { MockProviderV3 } from '../test/mock-provider-v3';
import { MockProviderV4 } from '../test/mock-provider-v4';
import { MockRerankingModelV3 } from '../test/mock-reranking-model-v3';
import { MockRerankingModelV4 } from '../test/mock-reranking-model-v4';
import { MockSpeechModelV3 } from '../test/mock-speech-model-v3';
import { MockSpeechModelV4 } from '../test/mock-speech-model-v4';
import { MockTranscriptionModelV3 } from '../test/mock-transcription-model-v3';
import { MockTranscriptionModelV4 } from '../test/mock-transcription-model-v4';
import { MockVideoModelV3 } from '../test/mock-video-model-v3';
import { MockVideoModelV4 } from '../test/mock-video-model-v4';

type RegistryProvider = ProviderV4 | ProviderV3;

/** Same construction as `ProviderRegistryProvider` for assertion-only tests. */
type RegistryLanguageModelIdentifier<
  registeredProviders extends Record<string, RegistryProvider>,
  separator extends string = ':',
> = {
  [providerKey in keyof registeredProviders]: providerKey extends string
    ? `${providerKey & string}${separator}${ExtractLiteralUnion<
        Parameters<
          NonNullable<registeredProviders[providerKey]['languageModel']>
        >[0]
      >}`
    : never;
}[keyof registeredProviders];

type RegistryEmbeddingModelIdentifier<
  registeredProviders extends Record<string, RegistryProvider>,
  separator extends string = ':',
> = {
  [providerKey in keyof registeredProviders]: providerKey extends string
    ? `${providerKey & string}${separator}${ExtractLiteralUnion<
        Parameters<
          NonNullable<registeredProviders[providerKey]['embeddingModel']>
        >[0]
      >}`
    : never;
}[keyof registeredProviders];

type RegistryImageModelIdentifier<
  registeredProviders extends Record<string, RegistryProvider>,
  separator extends string = ':',
> = {
  [providerKey in keyof registeredProviders]: providerKey extends string
    ? `${providerKey & string}${separator}${ExtractLiteralUnion<
        Parameters<
          NonNullable<registeredProviders[providerKey]['imageModel']>
        >[0]
      >}`
    : never;
}[keyof registeredProviders];

type RegistryTranscriptionModelIdentifier<
  registeredProviders extends Record<string, RegistryProvider>,
  separator extends string = ':',
> = {
  [providerKey in keyof registeredProviders]: providerKey extends string
    ? `${providerKey & string}${separator}${ExtractLiteralUnion<
        Parameters<
          NonNullable<registeredProviders[providerKey]['transcriptionModel']>
        >[0]
      >}`
    : never;
}[keyof registeredProviders];

type RegistrySpeechModelIdentifier<
  registeredProviders extends Record<string, RegistryProvider>,
  separator extends string = ':',
> = {
  [providerKey in keyof registeredProviders]: providerKey extends string
    ? `${providerKey & string}${separator}${ExtractLiteralUnion<
        Parameters<
          NonNullable<registeredProviders[providerKey]['speechModel']>
        >[0]
      >}`
    : never;
}[keyof registeredProviders];

type RegistryRerankingModelIdentifier<
  registeredProviders extends Record<string, RegistryProvider>,
  separator extends string = ':',
> = {
  [providerKey in keyof registeredProviders]: providerKey extends string
    ? `${providerKey & string}${separator}${ExtractLiteralUnion<
        Parameters<
          NonNullable<registeredProviders[providerKey]['rerankingModel']>
        >[0]
      >}`
    : never;
}[keyof registeredProviders];

type RegistryVideoModelIdentifier<
  registeredProviders extends Record<string, RegistryProvider>,
  separator extends string = ':',
> = {
  [providerKey in keyof registeredProviders]: providerKey extends string
    ? registeredProviders[providerKey] extends {
        videoModel: (...args: infer args) => unknown;
      }
      ? `${providerKey & string}${separator}${ExtractLiteralUnion<args[0]>}`
      : never
    : never;
}[keyof registeredProviders];

describe('createProviderRegistry autocomplete / literal identifiers', () => {
  const languageModel = new MockLanguageModelV4();
  const embeddingModel = new MockEmbeddingModelV4();
  const imageModel = new MockImageModelV4();
  const transcriptionModel = new MockTranscriptionModelV4();
  const speechModel = new MockSpeechModelV4();
  const rerankingModel = new MockRerankingModelV4();
  const videoModel = new MockVideoModelV4();

  const anthropicCustomProvider = customProvider({
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
      video: videoModel,
    },
  });

  const openaiCustomProvider = customProvider({
    languageModels: {
      'gpt-5': languageModel,
      'gpt-4o-high-reasoning': languageModel,
    },
    embeddingModels: {
      'text-embedding-3-small': embeddingModel,
    },
    imageModels: {
      dalle: imageModel,
    },
    videoModels: {
      sora: videoModel,
    },
  });

  const registeredProviders = {
    openai: openaiCustomProvider,
    anthropic: anthropicCustomProvider,
  };

  const registry = createProviderRegistry(registeredProviders);

  it('infers a finite union of language model identifiers (autocomplete-friendly)', () => {
    type ExpectedLanguageModelIdentifiers =
      | 'openai:gpt-5'
      | 'openai:gpt-4o-high-reasoning'
      | 'anthropic:opus'
      | 'anthropic:sonnet'
      | 'anthropic:haiku';

    expectTypeOf<
      RegistryLanguageModelIdentifier<typeof registeredProviders>
    >().toEqualTypeOf<ExpectedLanguageModelIdentifiers>();

    expectTypeOf(
      registry.languageModel('openai:gpt-5'),
    ).toEqualTypeOf<LanguageModelV4>();
    expectTypeOf(
      registry.languageModel('anthropic:haiku'),
    ).toEqualTypeOf<LanguageModelV4>();

    expectTypeOf<'anthropic:opus'>().toMatchTypeOf<
      RegistryLanguageModelIdentifier<typeof registeredProviders>
    >();
    expectTypeOf<'openai:gpt-5'>().toMatchTypeOf<
      RegistryLanguageModelIdentifier<typeof registeredProviders>
    >();

    expectTypeOf<
      RegistryLanguageModelIdentifier<typeof registeredProviders>
    >().not.toMatchTypeOf<'openai:not-a-configured-alias'>();
    expectTypeOf<
      RegistryLanguageModelIdentifier<typeof registeredProviders>
    >().not.toMatchTypeOf<'anthropic:typo-model'>();
  });

  it('infers literal unions per model kind', () => {
    type ExpectedEmbeddingModelIdentifiers =
      | 'openai:text-embedding-3-small'
      | 'anthropic:small'
      | 'anthropic:large';

    type ExpectedImageModelIdentifiers = 'openai:dalle' | 'anthropic:photon';

    type ExpectedTranscriptionModelIdentifiers = 'anthropic:whisper-1';

    type ExpectedSpeechModelIdentifiers = 'anthropic:tts1';

    type ExpectedRerankingModelIdentifiers = 'anthropic:rerank';

    type ExpectedVideoModelIdentifiers = 'openai:sora' | 'anthropic:video';

    expectTypeOf<
      RegistryEmbeddingModelIdentifier<typeof registeredProviders>
    >().toEqualTypeOf<ExpectedEmbeddingModelIdentifiers>();
    expectTypeOf<
      RegistryImageModelIdentifier<typeof registeredProviders>
    >().toEqualTypeOf<ExpectedImageModelIdentifiers>();
    expectTypeOf<
      RegistryTranscriptionModelIdentifier<typeof registeredProviders>
    >().toEqualTypeOf<ExpectedTranscriptionModelIdentifiers>();
    expectTypeOf<
      RegistrySpeechModelIdentifier<typeof registeredProviders>
    >().toEqualTypeOf<ExpectedSpeechModelIdentifiers>();
    expectTypeOf<
      RegistryRerankingModelIdentifier<typeof registeredProviders>
    >().toEqualTypeOf<ExpectedRerankingModelIdentifiers>();
    expectTypeOf<
      RegistryVideoModelIdentifier<typeof registeredProviders>
    >().toEqualTypeOf<ExpectedVideoModelIdentifiers>();

    expectTypeOf(
      registry.embeddingModel('anthropic:small'),
    ).toEqualTypeOf<EmbeddingModelV4>();
    expectTypeOf(
      registry.imageModel('openai:dalle'),
    ).toEqualTypeOf<ImageModelV4>();
    expectTypeOf(
      registry.transcriptionModel('anthropic:whisper-1'),
    ).toEqualTypeOf<TranscriptionModelV4>();
    expectTypeOf(
      registry.speechModel('anthropic:tts1'),
    ).toEqualTypeOf<SpeechModelV4>();
    expectTypeOf(
      registry.rerankingModel('anthropic:rerank'),
    ).toEqualTypeOf<RerankingModelV4>();
    expectTypeOf(
      registry.videoModel('openai:sora'),
    ).toEqualTypeOf<Experimental_VideoModelV4>();
  });

  it('uses the custom separator in template-literal identifiers', () => {
    const registryWithCustomSeparator = createProviderRegistry(
      registeredProviders,
      { separator: ' > ' },
    );

    type ExpectedLanguageModelIdentifiersWithSeparator =
      RegistryLanguageModelIdentifier<typeof registeredProviders, ' > '>;

    expectTypeOf<
      RegistryLanguageModelIdentifier<typeof registeredProviders, ' > '>
    >().toEqualTypeOf<
      | 'openai > gpt-5'
      | 'openai > gpt-4o-high-reasoning'
      | 'anthropic > opus'
      | 'anthropic > sonnet'
      | 'anthropic > haiku'
    >();

    expectTypeOf(
      registryWithCustomSeparator.languageModel('anthropic > haiku'),
    ).toEqualTypeOf<LanguageModelV4>();

    expectTypeOf(registryWithCustomSeparator).toEqualTypeOf<
      ProviderRegistryProvider<typeof registeredProviders, ' > '>
    >();

    expectTypeOf<'anthropic > haiku'>().toMatchTypeOf<ExpectedLanguageModelIdentifiersWithSeparator>();
  });

  it('falls back to providerKey:any-model when the provider only uses string model ids', () => {
    const registryWithPlainProvider = createProviderRegistry({
      plain: new MockProviderV4({
        languageModels: { a: languageModel, b: languageModel },
      }),
    });

    expectTypeOf<
      RegistryLanguageModelIdentifier<{ plain: MockProviderV4 }>
    >().toEqualTypeOf<never>();

    expectTypeOf(
      registryWithPlainProvider.languageModel('plain:a'),
    ).toEqualTypeOf<LanguageModelV4>();
    expectTypeOf(
      registryWithPlainProvider.languageModel('plain:anything-goes'),
    ).toEqualTypeOf<LanguageModelV4>();

    type looseLanguageModelArgument = Parameters<
      (typeof registryWithPlainProvider)['languageModel']
    >[0];
    expectTypeOf<looseLanguageModelArgument>().toMatchTypeOf<`plain:${string}`>();
  });
});

describe('createProviderRegistry files and skills typing', () => {
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

  const registry = createProviderRegistry({
    openai: customProvider({ files }),
    anthropic: customProvider({ skills }),
  });

  it('returns files and skills interfaces by provider key', () => {
    expectTypeOf(registry.files('openai')).toEqualTypeOf<FilesV4>();
    expectTypeOf(registry.skills('anthropic')).toEqualTypeOf<SkillsV4>();
  });

  it('rejects provider keys that are not registered', () => {
    // @ts-expect-error provider key must exist in the registry
    registry.files('mistral');
    // @ts-expect-error provider key must exist in the registry
    registry.skills('mistral');
  });
});

describe('createProviderRegistry ProviderV3 typing', () => {
  const languageModel = new MockLanguageModelV3();
  const embeddingModel = new MockEmbeddingModelV3();
  const imageModel = new MockImageModelV3();
  const transcriptionModel = new MockTranscriptionModelV3();
  const speechModel = new MockSpeechModelV3();
  const rerankingModel = new MockRerankingModelV3();
  const videoModel = new MockVideoModelV3();

  const v3Provider = new MockProviderV3({
    languageModels: { language: languageModel },
    embeddingModels: { embedding: embeddingModel },
    imageModels: { image: imageModel },
    transcriptionModels: { transcription: transcriptionModel },
    speechModels: { speech: speechModel },
    rerankingModels: { reranking: rerankingModel },
  }) as MockProviderV3 & {
    videoModel(modelId: 'video'): MockVideoModelV3;
  };
  v3Provider.videoModel = () => videoModel;

  const registry = createProviderRegistry({
    v3: v3Provider,
  });

  it('accepts ProviderV3 providers and exposes ProviderV4 models', () => {
    expectTypeOf(registry).toEqualTypeOf<
      ProviderRegistryProvider<{ v3: MockProviderV3 }, ':'>
    >();

    expectTypeOf(
      registry.languageModel('v3:language'),
    ).toEqualTypeOf<LanguageModelV4>();
    expectTypeOf(
      registry.embeddingModel('v3:embedding'),
    ).toEqualTypeOf<EmbeddingModelV4>();
    expectTypeOf(registry.imageModel('v3:image')).toEqualTypeOf<ImageModelV4>();
    expectTypeOf(
      registry.transcriptionModel('v3:transcription'),
    ).toEqualTypeOf<TranscriptionModelV4>();
    expectTypeOf(
      registry.speechModel('v3:speech'),
    ).toEqualTypeOf<SpeechModelV4>();
    expectTypeOf(
      registry.rerankingModel('v3:reranking'),
    ).toEqualTypeOf<RerankingModelV4>();
    expectTypeOf(
      registry.videoModel('v3:video'),
    ).toEqualTypeOf<Experimental_VideoModelV4>();
  });

  it('keeps ProviderV3 registry identifiers scoped to registered provider keys', () => {
    type looseLanguageModelArgument = Parameters<
      (typeof registry)['languageModel']
    >[0];

    expectTypeOf<
      RegistryLanguageModelIdentifier<{ v3: MockProviderV3 }>
    >().toEqualTypeOf<never>();
    expectTypeOf<looseLanguageModelArgument>().toMatchTypeOf<`v3:${string}`>();

    registry.languageModel('v3:anything-goes');

    // @ts-expect-error provider key must exist in the registry
    registry.languageModel('unknown:language');
  });
});

describe('createProviderRegistry negative typing', () => {
  const languageModel = new MockLanguageModelV4();
  const embeddingModel = new MockEmbeddingModelV4();
  const imageModel = new MockImageModelV4();
  const transcriptionModel = new MockTranscriptionModelV4();
  const speechModel = new MockSpeechModelV4();
  const rerankingModel = new MockRerankingModelV4();

  const anthropicOnlyRegisteredProviders = {
    anthropic: customProvider({
      languageModels: { haiku: languageModel },
      embeddingModels: { small: embeddingModel },
      imageModels: { photon: imageModel },
      transcriptionModels: { 'whisper-1': transcriptionModel },
      speechModels: { tts1: speechModel },
      rerankingModels: { rerank: rerankingModel },
    }),
  };

  const registryAnthropicOnly = createProviderRegistry(
    anthropicOnlyRegisteredProviders,
  );

  it('rejects registry identifiers whose provider key is not registered (language model)', () => {
    registryAnthropicOnly.languageModel('anthropic:haiku');

    // @ts-expect-error provider key must exist in the registry
    registryAnthropicOnly.languageModel('unknown:haiku');
  });

  it('rejects registry identifiers whose provider key is not registered (other model kinds)', () => {
    registryAnthropicOnly.embeddingModel('anthropic:small');
    registryAnthropicOnly.imageModel('anthropic:photon');
    registryAnthropicOnly.transcriptionModel('anthropic:whisper-1');
    registryAnthropicOnly.speechModel('anthropic:tts1');
    registryAnthropicOnly.rerankingModel('anthropic:rerank');

    // @ts-expect-error provider key must exist in the registry
    registryAnthropicOnly.embeddingModel('unknown:small');
    // @ts-expect-error provider key must exist in the registry
    registryAnthropicOnly.imageModel('unknown:photon');
    // @ts-expect-error provider key must exist in the registry
    registryAnthropicOnly.transcriptionModel('unknown:whisper-1');
    // @ts-expect-error provider key must exist in the registry
    registryAnthropicOnly.speechModel('unknown:tts1');
    // @ts-expect-error provider key must exist in the registry
    registryAnthropicOnly.rerankingModel('unknown:rerank');
  });

  it('rejects the default colon separator when the registry uses a custom separator', () => {
    const registryWithCustomSeparator = createProviderRegistry(
      anthropicOnlyRegisteredProviders,
      { separator: ' > ' },
    );

    registryWithCustomSeparator.languageModel('anthropic > haiku');

    // @ts-expect-error separator must match the configured registry separator
    registryWithCustomSeparator.languageModel('anthropic:haiku');
  });

  it('rejects identifiers when the provider key is not registered (narrow registry)', () => {
    const registeredProvidersOpenaiOnly = {
      openai: customProvider({
        languageModels: { 'gpt-5': languageModel },
        embeddingModels: { 'text-embedding-3-small': embeddingModel },
      }),
    };
    const registryOpenaiOnly = createProviderRegistry(
      registeredProvidersOpenaiOnly,
    );

    registryOpenaiOnly.languageModel('openai:gpt-5');
    registryOpenaiOnly.embeddingModel('openai:text-embedding-3-small');

    // @ts-expect-error anthropic is not a registered provider key
    registryOpenaiOnly.languageModel('anthropic:haiku');
    // @ts-expect-error anthropic is not a registered provider key
    registryOpenaiOnly.embeddingModel('anthropic:small');
  });

  it('rejects identifiers for providers that are absent from a multi-provider registry', () => {
    const multiRegisteredProviders = {
      openai: customProvider({
        languageModels: { 'gpt-5': languageModel },
      }),
      anthropic: customProvider({
        languageModels: { haiku: languageModel },
      }),
    };
    const multiProviderRegistry = createProviderRegistry(
      multiRegisteredProviders,
    );

    multiProviderRegistry.languageModel('openai:gpt-5');
    multiProviderRegistry.languageModel('anthropic:haiku');

    // @ts-expect-error mistral is not a registered provider key
    multiProviderRegistry.languageModel('mistral:whatever');
    // @ts-expect-error mistral is not a registered provider key
    multiProviderRegistry.imageModel('mistral:any');
  });

  it('still accepts arbitrary model suffix for a registered provider (second overload)', () => {
    // Not every typo is a type error; identifier validation happens at runtime.
    registryAnthropicOnly.languageModel('anthropic:dynamic-or-typo');
  });
});
