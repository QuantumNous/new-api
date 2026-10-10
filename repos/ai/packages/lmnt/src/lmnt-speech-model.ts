import type { SpeechModelV4, SharedV4Warning } from '@ai-sdk/provider';
import {
  combineHeaders,
  createBinaryResponseHandler,
  parseProviderOptions,
  postJsonToApi,
  serializeModelOptions,
  WORKFLOW_SERIALIZE,
  WORKFLOW_DESERIALIZE,
} from '@ai-sdk/provider-utils';
import type { LMNTConfig } from './lmnt-config';
import { lmntFailedResponseHandler } from './lmnt-error';
import { lmntSpeechModelOptionsSchema } from './lmnt-speech-model-options';
import type { LMNTSpeechModelId } from './lmnt-speech-options';
import type { LMNTSpeechAPITypes } from './lmnt-api-types';

interface LMNTSpeechModelConfig extends LMNTConfig {
  _internal?: {
    currentDate?: () => Date;
  };
}

export class LMNTSpeechModel implements SpeechModelV4 {
  readonly specificationVersion = 'v4';

  get provider(): string {
    return this.config.provider;
  }

  static [WORKFLOW_SERIALIZE](model: LMNTSpeechModel) {
    return serializeModelOptions({
      modelId: model.modelId,
      config: model.config,
    });
  }

  static [WORKFLOW_DESERIALIZE](options: {
    modelId: LMNTSpeechModelId;
    config: LMNTSpeechModelConfig;
  }) {
    return new LMNTSpeechModel(options.modelId, options.config);
  }

  constructor(
    readonly modelId: LMNTSpeechModelId,
    private readonly config: LMNTSpeechModelConfig,
  ) {}

  private async getArgs({
    text,
    voice = 'ava',
    outputFormat = 'mp3',
    speed,
    language,
    providerOptions,
  }: Parameters<SpeechModelV4['doGenerate']>[0]) {
    const warnings: SharedV4Warning[] = [];

    // Parse provider options
    const lmntOptions = await parseProviderOptions({
      provider: 'lmnt',
      providerOptions,
      schema: lmntSpeechModelOptionsSchema,
    });

    // Create request body
    const requestBody: Record<string, unknown> = {
      model: this.modelId,
      text,
      voice,
      response_format: 'mp3',
      speed,
    };

    if (outputFormat) {
      if (['mp3', 'aac', 'mulaw', 'raw', 'wav'].includes(outputFormat)) {
        requestBody.response_format = outputFormat;
      } else {
        warnings.push({
          type: 'unsupported',
          feature: 'outputFormat',
          details: `Unsupported output format: ${outputFormat}. Using mp3 instead.`,
        });
      }
    }

    // Add provider-specific options
    if (lmntOptions) {
      const speechModelOptions: Omit<LMNTSpeechAPITypes, 'voice' | 'text'> = {
        conversational: lmntOptions.conversational ?? undefined,
        length: lmntOptions.length ?? undefined,
        seed: lmntOptions.seed ?? undefined,
        speed: lmntOptions.speed ?? undefined,
        temperature: lmntOptions.temperature ?? undefined,
        top_p: lmntOptions.topP ?? undefined,
        sample_rate: lmntOptions.sampleRate ?? undefined,
      };

      for (const key in speechModelOptions) {
        const value =
          speechModelOptions[
            key as keyof Omit<LMNTSpeechAPITypes, 'voice' | 'text'>
          ];
        if (value !== undefined) {
          requestBody[key] = value;
        }
      }
    }

    if (language) {
      requestBody.language = language;
    }

    return {
      requestBody,
      warnings,
    };
  }

  async doGenerate(
    options: Parameters<SpeechModelV4['doGenerate']>[0],
  ): Promise<Awaited<ReturnType<SpeechModelV4['doGenerate']>>> {
    const currentDate = this.config._internal?.currentDate?.() ?? new Date();
    const { requestBody, warnings } = await this.getArgs(options);

    const {
      value: audio,
      responseHeaders,
      rawValue: rawResponse,
    } = await postJsonToApi({
      url: this.config.url({
        path: '/v1/ai/speech/bytes',
        modelId: this.modelId,
      }),
      headers: combineHeaders(this.config.headers?.(), options.headers),
      body: requestBody,
      failedResponseHandler: lmntFailedResponseHandler,
      successfulResponseHandler: createBinaryResponseHandler(),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    return {
      audio,
      warnings,
      request: {
        body: JSON.stringify(requestBody),
      },
      response: {
        timestamp: currentDate,
        modelId: this.modelId,
        headers: responseHeaders,
        body: rawResponse,
      },
    };
  }
}
