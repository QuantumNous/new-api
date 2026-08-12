import {
  AISDKError,
  type TranscriptionModelV4,
  type SharedV4Warning,
} from '@ai-sdk/provider';
import {
  combineHeaders,
  convertUint8ArrayToBase64,
  createJsonErrorResponseHandler,
  createJsonResponseHandler,
  delay,
  getFromApi,
  parseProviderOptions,
  postJsonToApi,
  serializeModelOptions,
  WORKFLOW_SERIALIZE,
  WORKFLOW_DESERIALIZE,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';
import type { FalConfig } from './fal-config';
import { falErrorDataSchema, falFailedResponseHandler } from './fal-error';
import { falTranscriptionModelOptionsSchema } from './fal-transcription-model-options';
import type { FalTranscriptionModelId } from './fal-transcription-options';
import type { FalTranscriptionAPITypes } from './fal-api-types';

interface FalTranscriptionModelConfig extends FalConfig {
  _internal?: {
    currentDate?: () => Date;
  };
}

export class FalTranscriptionModel implements TranscriptionModelV4 {
  readonly specificationVersion = 'v4';

  get provider(): string {
    return this.config.provider;
  }

  static [WORKFLOW_SERIALIZE](model: FalTranscriptionModel) {
    return serializeModelOptions({
      modelId: model.modelId,
      config: model.config,
    });
  }

  static [WORKFLOW_DESERIALIZE](options: {
    modelId: FalTranscriptionModelId;
    config: FalTranscriptionModelConfig;
  }) {
    return new FalTranscriptionModel(options.modelId, options.config);
  }

  constructor(
    readonly modelId: FalTranscriptionModelId,
    private readonly config: FalTranscriptionModelConfig,
  ) {}

  private async getArgs({
    providerOptions,
  }: Parameters<TranscriptionModelV4['doGenerate']>[0]) {
    const warnings: SharedV4Warning[] = [];

    // Parse provider options
    const falOptions = await parseProviderOptions({
      provider: 'fal',
      providerOptions,
      schema: falTranscriptionModelOptionsSchema,
    });

    // Create form data with base fields
    const body: Omit<FalTranscriptionAPITypes, 'audio_url'> = {
      task: 'transcribe',
      diarize: true,
      chunk_level: 'word',
    };

    // Add provider-specific options
    if (falOptions) {
      body.language = falOptions.language as never;
      body.version = falOptions.version ?? undefined;
      body.batch_size = falOptions.batchSize ?? undefined;
      body.num_speakers = falOptions.numSpeakers ?? undefined;

      if (typeof falOptions.diarize === 'boolean') {
        body.diarize = falOptions.diarize;
      }

      if (falOptions.chunkLevel) {
        body.chunk_level = falOptions.chunkLevel;
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
    const { body, warnings } = await this.getArgs(options);

    const base64Audio =
      typeof options.audio === 'string'
        ? options.audio
        : convertUint8ArrayToBase64(options.audio);

    const audioUrl = `data:${options.mediaType};base64,${base64Audio}`;

    const { value: queueResponse } = await postJsonToApi({
      url: this.config.url({
        path: `https://queue.fal.run/fal-ai/${this.modelId}`,
        modelId: this.modelId,
      }),
      headers: combineHeaders(this.config.headers?.(), options.headers),
      body: {
        ...body,
        audio_url: audioUrl,
      },
      failedResponseHandler: falFailedResponseHandler,
      successfulResponseHandler:
        createJsonResponseHandler(falJobResponseSchema),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    // Poll for completion with timeout
    const startTime = Date.now();
    const timeoutMs = 60000; // 60 seconds timeout
    const pollIntervalMs = 1000; // 1 second interval

    let response;
    let responseHeaders;
    let rawResponse;

    while (true) {
      try {
        const {
          value: statusResponse,
          responseHeaders: statusHeaders,
          rawValue: statusRawResponse,
        } = await getFromApi({
          url: this.config.url({
            path: `https://queue.fal.run/fal-ai/${this.modelId}/requests/${queueResponse.request_id}`,
            modelId: this.modelId,
          }),
          headers: combineHeaders(this.config.headers?.(), options.headers),
          failedResponseHandler: async ({
            requestBodyValues,
            response,
            url,
          }) => {
            const clone = response.clone();
            const body = (await clone.json()) as { detail: string };

            if (body.detail === 'Request is still in progress') {
              // This is not an error, just a status update that the request is still processing
              // Continue polling by returning a special error that signals to continue
              return {
                value: new Error('Request is still in progress'),
                rawValue: body,
                responseHeaders: {},
              };
            }

            return createJsonErrorResponseHandler({
              errorSchema: falErrorDataSchema,
              errorToMessage: data => data.error.message,
            })({ requestBodyValues, response, url });
          },
          successfulResponseHandler: createJsonResponseHandler(
            falTranscriptionResponseSchema,
          ),
          abortSignal: options.abortSignal,
          fetch: this.config.fetch,
        });

        response = statusResponse;
        responseHeaders = statusHeaders;
        rawResponse = statusRawResponse;
        break;
      } catch (error) {
        // If the error message indicates the request is still in progress, ignore it and continue polling
        if (
          error instanceof Error &&
          error.message === 'Request is still in progress'
        ) {
          // Continue with the polling loop
        } else {
          // Re-throw any other errors
          throw error;
        }
      }

      // Check if we've exceeded the timeout
      if (Date.now() - startTime > timeoutMs) {
        throw new AISDKError({
          message: 'Transcription request timed out after 60 seconds',
          name: 'TranscriptionRequestTimedOut',
          cause: response,
        });
      }

      // Wait before polling again
      await delay(pollIntervalMs);
    }

    return {
      text: response.text,
      segments:
        response.chunks?.map(chunk => ({
          text: chunk.text,
          startSecond: chunk.timestamp?.at(0) ?? 0,
          endSecond: chunk.timestamp?.at(1) ?? 0,
        })) ?? [],
      language: response.inferred_languages?.at(0) ?? undefined,
      durationInSeconds: response.chunks?.at(-1)?.timestamp?.at(1) ?? undefined,
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

const falJobResponseSchema = z.object({
  request_id: z.string().nullish(),
});

const falTranscriptionResponseSchema = z.object({
  text: z.string(),
  chunks: z
    .array(
      z.object({
        text: z.string(),
        timestamp: z.array(z.number()).nullish(),
      }),
    )
    .nullish(),
  inferred_languages: z.array(z.string()).nullish(),
});
