import type { SharedV4Warning, TranscriptionModelV4 } from '@ai-sdk/provider';
import {
  combineHeaders,
  createJsonResponseHandler,
  parseProviderOptions,
  postToApi,
  serializeModelOptions,
  WORKFLOW_SERIALIZE,
  WORKFLOW_DESERIALIZE,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';
import type { DeepgramTranscriptionAPITypes } from './deepgram-api-types';
import type { DeepgramConfig } from './deepgram-config';
import { deepgramFailedResponseHandler } from './deepgram-error';
import { deepgramTranscriptionModelOptionsSchema } from './deepgram-transcription-model-options';
import type { DeepgramTranscriptionModelId } from './deepgram-transcription-options';

interface DeepgramTranscriptionModelConfig extends DeepgramConfig {
  _internal?: {
    currentDate?: () => Date;
  };
}

export class DeepgramTranscriptionModel implements TranscriptionModelV4 {
  readonly specificationVersion = 'v4';

  get provider(): string {
    return this.config.provider;
  }

  static [WORKFLOW_SERIALIZE](model: DeepgramTranscriptionModel) {
    return serializeModelOptions({
      modelId: model.modelId,
      config: model.config,
    });
  }

  static [WORKFLOW_DESERIALIZE](options: {
    modelId: DeepgramTranscriptionModelId;
    config: DeepgramTranscriptionModelConfig;
  }) {
    return new DeepgramTranscriptionModel(options.modelId, options.config);
  }

  constructor(
    readonly modelId: DeepgramTranscriptionModelId,
    private readonly config: DeepgramTranscriptionModelConfig,
  ) {}

  private async getArgs({
    providerOptions,
  }: Parameters<TranscriptionModelV4['doGenerate']>[0]) {
    const warnings: SharedV4Warning[] = [];

    // Parse provider options
    const deepgramOptions = await parseProviderOptions({
      provider: 'deepgram',
      providerOptions,
      schema: deepgramTranscriptionModelOptionsSchema,
    });

    const body: DeepgramTranscriptionAPITypes = {
      model: this.modelId,
      diarize: true,
    };

    // Add provider-specific options
    if (deepgramOptions) {
      body.detect_entities = deepgramOptions.detectEntities ?? undefined;
      body.detect_language = deepgramOptions.detectLanguage ?? undefined;
      body.filler_words = deepgramOptions.fillerWords ?? undefined;
      body.language = deepgramOptions.language ?? undefined;
      body.punctuate = deepgramOptions.punctuate ?? undefined;
      body.redact = deepgramOptions.redact ?? undefined;
      body.search = deepgramOptions.search ?? undefined;
      body.smart_format = deepgramOptions.smartFormat ?? undefined;
      body.summarize = deepgramOptions.summarize ?? undefined;
      body.topics = deepgramOptions.topics ?? undefined;
      body.utterances = deepgramOptions.utterances ?? undefined;
      body.utt_split = deepgramOptions.uttSplit ?? undefined;

      if (typeof deepgramOptions.diarize === 'boolean') {
        body.diarize = deepgramOptions.diarize;
      }
    }

    // Convert body to URL query parameters
    const queryParams = new URLSearchParams();
    for (const [key, value] of Object.entries(body)) {
      if (value !== undefined) {
        queryParams.append(key, String(value));
      }
    }

    return {
      queryParams,
      warnings,
    };
  }

  async doGenerate(
    options: Parameters<TranscriptionModelV4['doGenerate']>[0],
  ): Promise<Awaited<ReturnType<TranscriptionModelV4['doGenerate']>>> {
    const currentDate = this.config._internal?.currentDate?.() ?? new Date();
    const { queryParams, warnings } = await this.getArgs(options);

    const {
      value: response,
      responseHeaders,
      rawValue: rawResponse,
    } = await postToApi({
      url:
        this.config.url({
          path: '/v1/listen',
          modelId: this.modelId,
        }) +
        '?' +
        queryParams.toString(),
      headers: {
        ...combineHeaders(this.config.headers?.(), options.headers),
        'Content-Type': options.mediaType,
      },
      body: {
        content: options.audio,
        values: options.audio,
      },
      failedResponseHandler: deepgramFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        deepgramTranscriptionResponseSchema,
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    return {
      text:
        response.results?.channels.at(0)?.alternatives.at(0)?.transcript ?? '',
      segments:
        response.results?.channels[0].alternatives[0].words?.map(word => ({
          text: word.word,
          startSecond: word.start,
          endSecond: word.end,
        })) ?? [],
      language:
        response.results?.channels.at(0)?.detected_language ?? undefined,
      durationInSeconds: response.metadata?.duration ?? undefined,
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

const deepgramTranscriptionResponseSchema = z.object({
  metadata: z
    .object({
      duration: z.number(),
    })
    .nullish(),
  results: z
    .object({
      channels: z.array(
        z.object({
          detected_language: z.string().nullish(),
          alternatives: z.array(
            z.object({
              transcript: z.string(),
              words: z.array(
                z.object({
                  word: z.string(),
                  start: z.number(),
                  end: z.number(),
                }),
              ),
            }),
          ),
        }),
      ),
    })
    .nullish(),
});
