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
import type { HumeConfig } from './hume-config';
import { humeFailedResponseHandler } from './hume-error';
import { humeSpeechModelOptionsSchema } from './hume-speech-model-options';
import type { HumeSpeechAPITypes } from './hume-api-types';

interface HumeSpeechModelConfig extends HumeConfig {
  _internal?: {
    currentDate?: () => Date;
  };
}

export class HumeSpeechModel implements SpeechModelV4 {
  readonly specificationVersion = 'v4';

  get provider(): string {
    return this.config.provider;
  }

  static [WORKFLOW_SERIALIZE](model: HumeSpeechModel) {
    return serializeModelOptions({
      modelId: model.modelId,
      config: model.config,
    });
  }

  static [WORKFLOW_DESERIALIZE](options: {
    modelId: '';
    config: HumeSpeechModelConfig;
  }) {
    return new HumeSpeechModel(options.modelId as '', options.config);
  }

  constructor(
    readonly modelId: '',
    private readonly config: HumeSpeechModelConfig,
  ) {}

  private async getArgs({
    text,
    voice = 'd8ab67c6-953d-4bd8-9370-8fa53a0f1453',
    outputFormat = 'mp3',
    speed,
    instructions,
    language,
    providerOptions,
  }: Parameters<SpeechModelV4['doGenerate']>[0]) {
    const warnings: SharedV4Warning[] = [];

    // Parse provider options
    const humeOptions = await parseProviderOptions({
      provider: 'hume',
      providerOptions,
      schema: humeSpeechModelOptionsSchema,
    });

    // Create request body
    const requestBody: HumeSpeechAPITypes = {
      utterances: [
        {
          text,
          speed,
          description: instructions,
          voice: {
            id: voice,
            provider: 'HUME_AI',
          },
        },
      ],
      format: { type: 'mp3' },
    };

    if (outputFormat) {
      if (['mp3', 'pcm', 'wav'].includes(outputFormat)) {
        requestBody.format = { type: outputFormat as 'mp3' | 'pcm' | 'wav' };
      } else {
        warnings.push({
          type: 'unsupported',
          feature: 'outputFormat',
          details: `Unsupported output format: ${outputFormat}. Using mp3 instead.`,
        });
      }
    }

    // Add provider-specific options
    if (humeOptions) {
      const speechModelOptions: Omit<
        HumeSpeechAPITypes,
        'utterances' | 'format'
      > = {};

      if (humeOptions.context) {
        if ('generationId' in humeOptions.context) {
          speechModelOptions.context = {
            generation_id: humeOptions.context.generationId,
          };
        } else {
          speechModelOptions.context = {
            utterances: humeOptions.context.utterances.map(utterance => ({
              text: utterance.text,
              description: utterance.description,
              speed: utterance.speed,
              trailing_silence: utterance.trailingSilence,
              voice: utterance.voice,
            })),
          };
        }
      }

      for (const key in speechModelOptions) {
        const value =
          speechModelOptions[
            key as keyof Omit<HumeSpeechAPITypes, 'utterances' | 'format'>
          ];
        if (value !== undefined) {
          (requestBody as Record<string, unknown>)[key] = value;
        }
      }
    }

    if (language) {
      warnings.push({
        type: 'unsupported',
        feature: 'language',
        details: `Hume speech models do not support language selection. Language parameter "${language}" was ignored.`,
      });
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
        path: '/v0/tts/file',
        modelId: this.modelId,
      }),
      headers: combineHeaders(this.config.headers?.(), options.headers),
      body: requestBody,
      failedResponseHandler: humeFailedResponseHandler,
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
