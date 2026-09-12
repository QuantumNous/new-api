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
import type { GroqConfig } from './groq-config';
import { groqFailedResponseHandler } from './groq-error';
import {
  groqTranscriptionModelOptions,
  type GroqTranscriptionModelId,
} from './groq-transcription-model-options';
import type { GroqTranscriptionAPITypes } from './groq-api-types';

interface GroqTranscriptionModelConfig extends GroqConfig {
  _internal?: {
    currentDate?: () => Date;
  };
}

export class GroqTranscriptionModel implements TranscriptionModelV4 {
  readonly specificationVersion = 'v4';

  get provider(): string {
    return this.config.provider;
  }

  static [WORKFLOW_SERIALIZE](model: GroqTranscriptionModel) {
    return serializeModelOptions({
      modelId: model.modelId,
      config: model.config,
    });
  }

  static [WORKFLOW_DESERIALIZE](options: {
    modelId: GroqTranscriptionModelId;
    config: GroqTranscriptionModelConfig;
  }) {
    return new GroqTranscriptionModel(options.modelId, options.config);
  }

  constructor(
    readonly modelId: GroqTranscriptionModelId,
    private readonly config: GroqTranscriptionModelConfig,
  ) {}

  private async getArgs({
    audio,
    mediaType,
    providerOptions,
  }: Parameters<TranscriptionModelV4['doGenerate']>[0]) {
    const warnings: SharedV4Warning[] = [];

    // Parse provider options
    const groqOptions = await parseProviderOptions({
      provider: 'groq',
      providerOptions,
      schema: groqTranscriptionModelOptions,
    });

    // Create form data with base fields
    const formData = new FormData();
    const blob =
      audio instanceof Uint8Array
        ? new Blob([audio])
        : new Blob([convertBase64ToUint8Array(audio)]);

    formData.append('model', this.modelId);
    const fileExtension = mediaTypeToExtension(mediaType);
    formData.append(
      'file',
      new File([blob], 'audio', { type: mediaType }),
      `audio.${fileExtension}`,
    );

    // Add provider-specific options
    if (groqOptions) {
      const transcriptionModelOptions: Omit<
        GroqTranscriptionAPITypes,
        'model'
      > = {
        language: groqOptions.language ?? undefined,
        prompt: groqOptions.prompt ?? undefined,
        response_format: groqOptions.responseFormat ?? undefined,
        temperature: groqOptions.temperature ?? undefined,
        timestamp_granularities:
          groqOptions.timestampGranularities ?? undefined,
      };

      for (const key in transcriptionModelOptions) {
        const value =
          transcriptionModelOptions[
            key as keyof Omit<GroqTranscriptionAPITypes, 'model'>
          ];
        if (value !== undefined) {
          if (Array.isArray(value)) {
            for (const item of value) {
              formData.append(`${key}[]`, String(item));
            }
          } else {
            formData.append(key, String(value));
          }
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
        path: '/audio/transcriptions',
        modelId: this.modelId,
      }),
      headers: combineHeaders(this.config.headers?.(), options.headers),
      formData,
      failedResponseHandler: groqFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        groqTranscriptionResponseSchema,
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    return {
      text: response.text,
      segments:
        response.segments?.map(segment => ({
          text: segment.text,
          startSecond: segment.start,
          endSecond: segment.end,
        })) ?? [],
      language: response.language ?? undefined,
      durationInSeconds: response.duration ?? undefined,
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

const groqTranscriptionResponseSchema = z.object({
  text: z.string(),
  x_groq: z.object({
    id: z.string(),
  }),
  // additional properties are returned when `response_format: 'verbose_json'` is
  task: z.string().nullish(),
  language: z.string().nullish(),
  duration: z.number().nullish(),
  segments: z
    .array(
      z.object({
        id: z.number(),
        seek: z.number(),
        start: z.number(),
        end: z.number(),
        text: z.string(),
        tokens: z.array(z.number()),
        temperature: z.number(),
        avg_logprob: z.number(),
        compression_ratio: z.number(),
        no_speech_prob: z.number(),
      }),
    )
    .nullish(),
});
