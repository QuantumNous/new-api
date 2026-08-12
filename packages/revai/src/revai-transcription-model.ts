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
  serializeModelOptions,
  WORKFLOW_SERIALIZE,
  WORKFLOW_DESERIALIZE,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';
import type { RevaiConfig } from './revai-config';
import { revaiFailedResponseHandler } from './revai-error';
import { revaiTranscriptionModelOptionsSchema } from './revai-transcription-model-options';
import type { RevaiTranscriptionModelId } from './revai-transcription-options';
import type { RevaiTranscriptionAPITypes } from './revai-api-types';

interface RevaiTranscriptionModelConfig extends RevaiConfig {
  _internal?: {
    currentDate?: () => Date;
  };
}

export class RevaiTranscriptionModel implements TranscriptionModelV4 {
  readonly specificationVersion = 'v4';

  get provider(): string {
    return this.config.provider;
  }

  static [WORKFLOW_SERIALIZE](model: RevaiTranscriptionModel) {
    return serializeModelOptions({
      modelId: model.modelId,
      config: model.config,
    });
  }

  static [WORKFLOW_DESERIALIZE](options: {
    modelId: RevaiTranscriptionModelId;
    config: RevaiTranscriptionModelConfig;
  }) {
    return new RevaiTranscriptionModel(options.modelId, options.config);
  }

  constructor(
    readonly modelId: RevaiTranscriptionModelId,
    private readonly config: RevaiTranscriptionModelConfig,
  ) {}

  private async getArgs({
    audio,
    mediaType,
    providerOptions,
  }: Parameters<TranscriptionModelV4['doGenerate']>[0]) {
    const warnings: SharedV4Warning[] = [];

    // Parse provider options
    const revaiOptions = await parseProviderOptions({
      provider: 'revai',
      providerOptions,
      schema: revaiTranscriptionModelOptionsSchema,
    });

    // Create form data with base fields
    const formData = new FormData();
    const blob =
      audio instanceof Uint8Array
        ? new Blob([audio])
        : new Blob([convertBase64ToUint8Array(audio)]);

    const fileExtension = mediaTypeToExtension(mediaType);
    formData.append(
      'media',
      new File([blob], 'audio', { type: mediaType }),
      `audio.${fileExtension}`,
    );
    const transcriptionModelOptions: RevaiTranscriptionAPITypes = {
      transcriber: this.modelId,
    };

    // Add provider-specific options
    if (revaiOptions) {
      const formDataConfig: RevaiTranscriptionAPITypes = {
        metadata: revaiOptions.metadata ?? undefined,
        notification_config: revaiOptions.notification_config ?? undefined,
        delete_after_seconds: revaiOptions.delete_after_seconds ?? undefined,
        verbatim: revaiOptions.verbatim ?? undefined,
        rush: revaiOptions.rush ?? undefined,
        test_mode: revaiOptions.test_mode ?? undefined,
        segments_to_transcribe:
          revaiOptions.segments_to_transcribe ?? undefined,
        speaker_names: revaiOptions.speaker_names ?? undefined,
        skip_diarization: revaiOptions.skip_diarization ?? undefined,
        skip_postprocessing: revaiOptions.skip_postprocessing ?? undefined,
        skip_punctuation: revaiOptions.skip_punctuation ?? undefined,
        remove_disfluencies: revaiOptions.remove_disfluencies ?? undefined,
        remove_atmospherics: revaiOptions.remove_atmospherics ?? undefined,
        filter_profanity: revaiOptions.filter_profanity ?? undefined,
        speaker_channels_count:
          revaiOptions.speaker_channels_count ?? undefined,
        speakers_count: revaiOptions.speakers_count ?? undefined,
        diarization_type: revaiOptions.diarization_type ?? undefined,
        custom_vocabulary_id: revaiOptions.custom_vocabulary_id ?? undefined,
        custom_vocabularies: revaiOptions.custom_vocabularies ?? undefined,
        strict_custom_vocabulary:
          revaiOptions.strict_custom_vocabulary ?? undefined,
        summarization_config: revaiOptions.summarization_config ?? undefined,
        translation_config: revaiOptions.translation_config ?? undefined,
        language: revaiOptions.language ?? undefined,
        forced_alignment: revaiOptions.forced_alignment ?? undefined,
      };

      for (const key in formDataConfig) {
        const value = formDataConfig[key as keyof RevaiTranscriptionAPITypes];
        if (value !== undefined) {
          (transcriptionModelOptions as Record<string, unknown>)[
            key as keyof RevaiTranscriptionAPITypes
          ] = value;
        }
      }
    }

    formData.append('config', JSON.stringify(transcriptionModelOptions));

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

    const { value: submissionResponse } = await postFormDataToApi({
      url: this.config.url({
        path: '/speechtotext/v1/jobs',
        modelId: this.modelId,
      }),
      headers: combineHeaders(this.config.headers?.(), options.headers),
      formData,
      failedResponseHandler: revaiFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        revaiTranscriptionJobResponseSchema,
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    if (submissionResponse.status === 'failed') {
      throw new AISDKError({
        message: 'Failed to submit transcription job to Rev.ai',
        name: 'TranscriptionJobSubmissionFailed',
        cause: submissionResponse,
      });
    }

    const jobId = submissionResponse.id;
    const timeoutMs = 60 * 1000; // 60 seconds timeout
    const startTime = Date.now();
    const pollingInterval = 1000;
    let jobResponse = submissionResponse;

    while (jobResponse.status !== 'transcribed') {
      // Check if we've exceeded the timeout
      if (Date.now() - startTime > timeoutMs) {
        throw new AISDKError({
          message: 'Transcription job polling timed out',
          name: 'TranscriptionJobPollingTimedOut',
          cause: submissionResponse,
        });
      }

      // Poll for job status
      const pollingResult = await getFromApi({
        url: this.config.url({
          path: `/speechtotext/v1/jobs/${jobId}`,
          modelId: this.modelId,
        }),
        headers: combineHeaders(this.config.headers?.(), options.headers),
        failedResponseHandler: revaiFailedResponseHandler,
        successfulResponseHandler: createJsonResponseHandler(
          revaiTranscriptionJobResponseSchema,
        ),
        abortSignal: options.abortSignal,
        fetch: this.config.fetch,
      });

      jobResponse = pollingResult.value;

      if (jobResponse.status === 'failed') {
        throw new AISDKError({
          message: 'Transcription job failed',
          name: 'TranscriptionJobFailed',
          cause: jobResponse,
        });
      }

      // Wait before polling again (only if we need to continue polling)
      if (jobResponse.status !== 'transcribed') {
        await delay(pollingInterval);
      }
    }

    const {
      value: transcriptionResult,
      responseHeaders,
      rawValue: rawResponse,
    } = await getFromApi({
      url: this.config.url({
        path: `/speechtotext/v1/jobs/${jobId}/transcript`,
        modelId: this.modelId,
      }),
      headers: combineHeaders(this.config.headers?.(), options.headers),
      failedResponseHandler: revaiFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        revaiTranscriptionResponseSchema,
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    let durationInSeconds = 0;
    const segments: {
      text: string;
      startSecond: number;
      endSecond: number;
    }[] = [];

    for (const monologue of transcriptionResult.monologues ?? []) {
      // Process each monologue to extract segments with timing information
      let currentSegmentText = '';
      let segmentStartSecond = 0;
      let hasStartedSegment = false;

      for (const element of monologue?.elements ?? []) {
        // Add the element value to the current segment text
        currentSegmentText += element.value;

        // For text elements, track timing information
        if (element.type === 'text') {
          // Update the overall duration if this is the latest timestamp
          if (element.end_ts && element.end_ts > durationInSeconds) {
            durationInSeconds = element.end_ts;
          }

          // If this is the first text element in a segment, mark the start time
          if (!hasStartedSegment && typeof element.ts === 'number') {
            segmentStartSecond = element.ts;
            hasStartedSegment = true;
          }

          // If we have an end timestamp, we can complete a segment
          if (typeof element.end_ts === 'number' && hasStartedSegment) {
            // Only add non-empty segments
            if (currentSegmentText.trim()) {
              segments.push({
                text: currentSegmentText.trim(),
                startSecond: segmentStartSecond,
                endSecond: element.end_ts,
              });
            }

            // Reset for the next segment
            currentSegmentText = '';
            hasStartedSegment = false;
          }
        }
      }

      // Handle any remaining segment text that wasn't added
      if (hasStartedSegment && currentSegmentText.trim()) {
        const endSecond =
          durationInSeconds > segmentStartSecond
            ? durationInSeconds
            : segmentStartSecond + 1;
        segments.push({
          text: currentSegmentText.trim(),
          startSecond: segmentStartSecond,
          endSecond: endSecond,
        });
      }
    }

    return {
      text:
        transcriptionResult.monologues
          ?.map(monologue =>
            monologue?.elements?.map(element => element.value).join(''),
          )
          .join(' ') ?? '',
      segments,
      language: submissionResponse.language ?? undefined,
      durationInSeconds,
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

const revaiTranscriptionJobResponseSchema = z.object({
  id: z.string().nullish(),
  status: z.string().nullish(),
  language: z.string().nullish(),
});

const revaiTranscriptionResponseSchema = z.object({
  monologues: z
    .array(
      z.object({
        elements: z
          .array(
            z.object({
              type: z.string().nullish(),
              value: z.string().nullish(),
              ts: z.number().nullish(),
              end_ts: z.number().nullish(),
            }),
          )
          .nullish(),
      }),
    )
    .nullish(),
});
