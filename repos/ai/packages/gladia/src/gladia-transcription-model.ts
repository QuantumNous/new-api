import {
  AISDKError,
  type TranscriptionModelV4,
  type SharedV4Warning,
} from '@ai-sdk/provider';
import {
  combineHeaders,
  convertBase64ToUint8Array,
  createJsonResponseHandler,
  mediaTypeToExtension,
  delay,
  getFromApi,
  parseProviderOptions,
  postFormDataToApi,
  postJsonToApi,
  serializeModelOptions,
  WORKFLOW_SERIALIZE,
  WORKFLOW_DESERIALIZE,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';
import type { GladiaConfig } from './gladia-config';
import { gladiaFailedResponseHandler } from './gladia-error';
import { gladiaTranscriptionModelOptionsSchema } from './gladia-transcription-model-options';
import type { GladiaTranscriptionInitiateAPITypes } from './gladia-api-types';

interface GladiaTranscriptionModelConfig extends GladiaConfig {
  _internal?: {
    currentDate?: () => Date;
  };
}

export class GladiaTranscriptionModel implements TranscriptionModelV4 {
  readonly specificationVersion = 'v4';

  get provider(): string {
    return this.config.provider;
  }

  static [WORKFLOW_SERIALIZE](model: GladiaTranscriptionModel) {
    return serializeModelOptions({
      modelId: model.modelId,
      config: model.config,
    });
  }

  static [WORKFLOW_DESERIALIZE](options: {
    modelId: 'default';
    config: GladiaTranscriptionModelConfig;
  }) {
    return new GladiaTranscriptionModel(options.modelId, options.config);
  }

  constructor(
    readonly modelId: string,
    private readonly config: GladiaTranscriptionModelConfig,
  ) {}

  private async getArgs({
    providerOptions,
  }: Parameters<TranscriptionModelV4['doGenerate']>[0]) {
    const warnings: SharedV4Warning[] = [];

    // Parse provider options
    const gladiaOptions = await parseProviderOptions({
      provider: 'gladia',
      providerOptions,
      schema: gladiaTranscriptionModelOptionsSchema,
    });

    const body: Omit<GladiaTranscriptionInitiateAPITypes, 'audio_url'> = {};

    // Add provider-specific options
    if (gladiaOptions) {
      body.context_prompt = gladiaOptions.contextPrompt ?? undefined;
      body.custom_vocabulary = gladiaOptions.customVocabulary ?? undefined;
      body.detect_language = gladiaOptions.detectLanguage ?? undefined;
      body.enable_code_switching =
        gladiaOptions.enableCodeSwitching ?? undefined;
      body.language = gladiaOptions.language ?? undefined;
      body.callback = gladiaOptions.callback ?? undefined;
      body.subtitles = gladiaOptions.subtitles ?? undefined;
      body.diarization = gladiaOptions.diarization ?? undefined;
      body.translation = gladiaOptions.translation ?? undefined;
      body.summarization = gladiaOptions.summarization ?? undefined;
      body.moderation = gladiaOptions.moderation ?? undefined;
      body.named_entity_recognition =
        gladiaOptions.namedEntityRecognition ?? undefined;
      body.chapterization = gladiaOptions.chapterization ?? undefined;
      body.name_consistency = gladiaOptions.nameConsistency ?? undefined;
      body.custom_spelling = gladiaOptions.customSpelling ?? undefined;
      body.structured_data_extraction =
        gladiaOptions.structuredDataExtraction ?? undefined;
      body.structured_data_extraction_config =
        gladiaOptions.structuredDataExtractionConfig ?? undefined;
      body.sentiment_analysis = gladiaOptions.sentimentAnalysis ?? undefined;
      body.audio_to_llm = gladiaOptions.audioToLlm ?? undefined;
      body.audio_to_llm_config = gladiaOptions.audioToLlmConfig ?? undefined;
      body.custom_metadata = gladiaOptions.customMetadata ?? undefined;
      body.sentences = gladiaOptions.sentences ?? undefined;
      body.display_mode = gladiaOptions.displayMode ?? undefined;
      body.punctuation_enhanced =
        gladiaOptions.punctuationEnhanced ?? undefined;

      if (gladiaOptions.customVocabularyConfig) {
        body.custom_vocabulary_config = {
          vocabulary: gladiaOptions.customVocabularyConfig.vocabulary.map(
            item => {
              if (typeof item === 'string') return item;
              return {
                value: item.value,
                intensity: item.intensity ?? undefined,
                pronunciations: item.pronunciations ?? undefined,
                language: item.language ?? undefined,
              };
            },
          ),
          default_intensity:
            gladiaOptions.customVocabularyConfig.defaultIntensity ?? undefined,
        };
      }

      // Handle code switching config
      if (gladiaOptions.codeSwitchingConfig) {
        body.code_switching_config = {
          languages: gladiaOptions.codeSwitchingConfig.languages ?? undefined,
        };
      }

      // Handle callback config
      if (gladiaOptions.callbackConfig) {
        body.callback_config = {
          url: gladiaOptions.callbackConfig.url,
          method: gladiaOptions.callbackConfig.method ?? undefined,
        };
      }

      // Handle subtitles config
      if (gladiaOptions.subtitlesConfig) {
        body.subtitles_config = {
          formats: gladiaOptions.subtitlesConfig.formats ?? undefined,
          minimum_duration:
            gladiaOptions.subtitlesConfig.minimumDuration ?? undefined,
          maximum_duration:
            gladiaOptions.subtitlesConfig.maximumDuration ?? undefined,
          maximum_characters_per_row:
            gladiaOptions.subtitlesConfig.maximumCharactersPerRow ?? undefined,
          maximum_rows_per_caption:
            gladiaOptions.subtitlesConfig.maximumRowsPerCaption ?? undefined,
          style: gladiaOptions.subtitlesConfig.style ?? undefined,
        };
      }

      // Handle diarization config
      if (gladiaOptions.diarizationConfig) {
        body.diarization_config = {
          number_of_speakers:
            gladiaOptions.diarizationConfig.numberOfSpeakers ?? undefined,
          min_speakers:
            gladiaOptions.diarizationConfig.minSpeakers ?? undefined,
          max_speakers:
            gladiaOptions.diarizationConfig.maxSpeakers ?? undefined,
          enhanced: gladiaOptions.diarizationConfig.enhanced ?? undefined,
        };
      }

      // Handle translation config
      if (gladiaOptions.translationConfig) {
        body.translation_config = {
          target_languages: gladiaOptions.translationConfig.targetLanguages,
          model: gladiaOptions.translationConfig.model ?? undefined,
          match_original_utterances:
            gladiaOptions.translationConfig.matchOriginalUtterances ??
            undefined,
        };
      }

      // Handle summarization config
      if (gladiaOptions.summarizationConfig) {
        body.summarization_config = {
          type: gladiaOptions.summarizationConfig.type ?? undefined,
        };
      }

      // Handle custom spelling config
      if (gladiaOptions.customSpellingConfig) {
        body.custom_spelling_config = {
          spelling_dictionary:
            gladiaOptions.customSpellingConfig.spellingDictionary,
        };
      }
    }

    return {
      body,
      warnings,
    };
  }

  async doGenerate(
    options: Parameters<TranscriptionModelV4['doGenerate']>[0],
  ): Promise<Awaited<ReturnType<TranscriptionModelV4['doGenerate']>>> {
    const currentDate = this.config._internal?.currentDate?.() ?? new Date();

    // Create form data with base fields
    const formData = new FormData();
    const blob =
      options.audio instanceof Uint8Array
        ? new Blob([options.audio])
        : new Blob([convertBase64ToUint8Array(options.audio)]);

    const fileExtension = mediaTypeToExtension(options.mediaType);
    formData.append(
      'audio',
      new File([blob], 'audio', { type: options.mediaType }),
      `audio.${fileExtension}`,
    );

    const { value: uploadResponse } = await postFormDataToApi({
      url: this.config.url({
        path: '/v2/upload',
        modelId: 'default',
      }),
      headers: combineHeaders(this.config.headers?.(), options.headers),
      formData,
      failedResponseHandler: gladiaFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        gladiaUploadResponseSchema,
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    const { body, warnings } = await this.getArgs(options);

    const { value: transcriptionInitResponse } = await postJsonToApi({
      url: this.config.url({
        path: '/v2/pre-recorded',
        modelId: 'default',
      }),
      headers: combineHeaders(this.config.headers?.(), options.headers),
      body: {
        ...body,
        audio_url: uploadResponse.audio_url,
      },
      failedResponseHandler: gladiaFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        gladiaTranscriptionInitializeResponseSchema,
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    // Poll the result URL until the transcription is done or an error occurs.
    // The result URL comes from the provider response; only send credentials
    // when it stays on the provider's own origin.
    const resultUrl = transcriptionInitResponse.result_url;
    const apiOrigin = this.config.url({ modelId: 'default', path: '' });
    let transcriptionResult;
    let transcriptionResultHeaders;
    const timeoutMs = 60 * 1000; // 60 seconds timeout
    const startTime = Date.now();
    const pollingInterval = 1000;

    while (true) {
      // Check if we've exceeded the timeout
      if (Date.now() - startTime > timeoutMs) {
        throw new AISDKError({
          message: 'Transcription job polling timed out',
          name: 'TranscriptionJobPollingTimedOut',
          cause: transcriptionResult,
        });
      }

      const response = await getFromApi({
        url: resultUrl,
        // resultUrl comes from the provider response body.
        validateUrl: true,
        credentialedOrigin: apiOrigin,
        trustedOrigin: apiOrigin,
        headers: combineHeaders(this.config.headers?.(), options.headers),
        failedResponseHandler: gladiaFailedResponseHandler,
        successfulResponseHandler: createJsonResponseHandler(
          gladiaTranscriptionResultResponseSchema,
        ),
        abortSignal: options.abortSignal,
        fetch: this.config.fetch,
      });

      transcriptionResult = response.value;
      transcriptionResultHeaders = response.responseHeaders;

      if (transcriptionResult.status === 'done') {
        break;
      }

      if (transcriptionResult.status === 'error') {
        throw new AISDKError({
          message: 'Transcription job failed',
          name: 'TranscriptionJobFailed',
          cause: transcriptionResult,
        });
      }

      // Wait for the configured polling interval before checking again
      await delay(pollingInterval);
    }

    if (!transcriptionResult.result) {
      throw new AISDKError({
        message: 'Transcription result is empty',
        name: 'TranscriptionResultEmpty',
        cause: transcriptionResult,
      });
    }

    // Process the successful result
    return {
      text: transcriptionResult.result.transcription.full_transcript,
      durationInSeconds: transcriptionResult.result.metadata.audio_duration,
      language: transcriptionResult.result.transcription.languages.at(0),
      segments: transcriptionResult.result.transcription.utterances.map(
        utterance => ({
          text: utterance.text,
          startSecond: utterance.start,
          endSecond: utterance.end,
        }),
      ),
      response: {
        timestamp: currentDate,
        modelId: 'default',
        headers: transcriptionResultHeaders,
      },
      providerMetadata: {
        gladia: transcriptionResult,
      },
      warnings,
    };
  }
}

const gladiaUploadResponseSchema = z.object({
  audio_url: z.string(),
});

const gladiaTranscriptionInitializeResponseSchema = z.object({
  result_url: z.string(),
});

const gladiaTranscriptionResultResponseSchema = z.object({
  status: z.enum(['queued', 'processing', 'done', 'error']),
  result: z
    .object({
      metadata: z.object({
        audio_duration: z.number(),
      }),
      transcription: z.object({
        full_transcript: z.string(),
        languages: z.array(z.string()),
        utterances: z.array(
          z.object({
            start: z.number(),
            end: z.number(),
            text: z.string(),
          }),
        ),
      }),
    })
    .nullish(),
});
