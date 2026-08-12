import type { TranscriptionModelV4, SharedV4Warning } from '@ai-sdk/provider';
import {
  combineHeaders,
  convertBase64ToUint8Array,
  createJsonResponseHandler,
  mediaTypeToExtension,
  parseProviderOptions,
  postFormDataToApi,
  serializeModelOptions,
  WORKFLOW_SERIALIZE,
  WORKFLOW_DESERIALIZE,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';
import type { ElevenLabsConfig } from './elevenlabs-config';
import { elevenlabsFailedResponseHandler } from './elevenlabs-error';
import { elevenLabsTranscriptionModelOptionsSchema } from './elevenlabs-transcription-model-options';
import type { ElevenLabsTranscriptionModelId } from './elevenlabs-transcription-options';
import type { ElevenLabsTranscriptionAPITypes } from './elevenlabs-api-types';

interface ElevenLabsTranscriptionModelConfig extends ElevenLabsConfig {
  _internal?: {
    currentDate?: () => Date;
  };
}

export class ElevenLabsTranscriptionModel implements TranscriptionModelV4 {
  readonly specificationVersion = 'v4';

  get provider(): string {
    return this.config.provider;
  }

  static [WORKFLOW_SERIALIZE](model: ElevenLabsTranscriptionModel) {
    return serializeModelOptions({
      modelId: model.modelId,
      config: model.config,
    });
  }

  static [WORKFLOW_DESERIALIZE](options: {
    modelId: ElevenLabsTranscriptionModelId;
    config: ElevenLabsTranscriptionModelConfig;
  }) {
    return new ElevenLabsTranscriptionModel(options.modelId, options.config);
  }

  constructor(
    readonly modelId: ElevenLabsTranscriptionModelId,
    private readonly config: ElevenLabsTranscriptionModelConfig,
  ) {}

  private async getArgs({
    audio,
    mediaType,
    providerOptions,
  }: Parameters<TranscriptionModelV4['doGenerate']>[0]) {
    const warnings: SharedV4Warning[] = [];

    // Parse provider options
    const elevenlabsOptions = await parseProviderOptions({
      provider: 'elevenlabs',
      providerOptions,
      schema: elevenLabsTranscriptionModelOptionsSchema,
    });

    // Create form data with base fields
    const formData = new FormData();
    const blob =
      audio instanceof Uint8Array
        ? new Blob([audio])
        : new Blob([convertBase64ToUint8Array(audio)]);

    formData.append('model_id', this.modelId);
    const fileExtension = mediaTypeToExtension(mediaType);
    formData.append(
      'file',
      new File([blob], 'audio', { type: mediaType }),
      `audio.${fileExtension}`,
    );
    formData.append('diarize', 'true');

    // Add provider-specific options
    if (elevenlabsOptions) {
      const transcriptionModelOptions: ElevenLabsTranscriptionAPITypes = {
        language_code: elevenlabsOptions.languageCode ?? undefined,
        tag_audio_events: elevenlabsOptions.tagAudioEvents ?? undefined,
        num_speakers: elevenlabsOptions.numSpeakers ?? undefined,
        timestamps_granularity:
          elevenlabsOptions.timestampsGranularity ?? undefined,
        file_format: elevenlabsOptions.fileFormat ?? undefined,
      };

      if (typeof elevenlabsOptions.diarize === 'boolean') {
        formData.append('diarize', String(elevenlabsOptions.diarize));
      }

      for (const key in transcriptionModelOptions) {
        const value =
          transcriptionModelOptions[
            key as keyof ElevenLabsTranscriptionAPITypes
          ];
        if (value !== undefined) {
          formData.append(key, String(value));
        }
      }
    }

    return {
      formData,
      warnings,
    };
  }

  async doGenerate(
    options: Parameters<TranscriptionModelV4['doGenerate']>[0],
  ): Promise<Awaited<ReturnType<TranscriptionModelV4['doGenerate']>>> {
    const currentDate = this.config._internal?.currentDate?.() ?? new Date();
    const { formData, warnings } = await this.getArgs(options);

    const {
      value: response,
      responseHeaders,
      rawValue: rawResponse,
    } = await postFormDataToApi({
      url: this.config.url({
        path: '/v1/speech-to-text',
        modelId: this.modelId,
      }),
      headers: combineHeaders(this.config.headers?.(), options.headers),
      formData,
      failedResponseHandler: elevenlabsFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        elevenlabsTranscriptionResponseSchema,
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    return {
      text: response.text,
      segments:
        response.words?.map(word => ({
          text: word.text,
          startSecond: word.start ?? 0,
          endSecond: word.end ?? 0,
        })) ?? [],
      language: response.language_code,
      durationInSeconds: response.words?.at(-1)?.end ?? undefined,
      warnings,
      response: {
        timestamp: currentDate,
        modelId: this.modelId,
        headers: responseHeaders,
        body: rawResponse,
      },
    };
  }
}

const elevenlabsTranscriptionResponseSchema = z.object({
  language_code: z.string(),
  language_probability: z.number(),
  text: z.string(),
  words: z
    .array(
      z.object({
        text: z.string(),
        type: z.enum(['word', 'spacing', 'audio_event']),
        start: z.number().nullish(),
        end: z.number().nullish(),
        speaker_id: z.string().nullish(),
        characters: z
          .array(
            z.object({
              text: z.string(),
              start: z.number().nullish(),
              end: z.number().nullish(),
            }),
          )
          .nullish(),
      }),
    )
    .nullish(),
});
