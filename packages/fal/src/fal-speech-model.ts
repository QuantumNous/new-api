import type { SpeechModelV4, SharedV4Warning } from '@ai-sdk/provider';
import {
  combineHeaders,
  createBinaryResponseHandler,
  createJsonResponseHandler,
  createStatusCodeErrorResponseHandler,
  getFromApi,
  parseProviderOptions,
  postJsonToApi,
  serializeModelOptions,
  WORKFLOW_SERIALIZE,
  WORKFLOW_DESERIALIZE,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';
import type { FalConfig } from './fal-config';
import { falFailedResponseHandler } from './fal-error';
import { falSpeechModelOptionsSchema } from './fal-speech-model-options';
import type { FalSpeechModelId } from './fal-speech-settings';

interface FalSpeechModelConfig extends FalConfig {
  _internal?: {
    currentDate?: () => Date;
  };
}

export class FalSpeechModel implements SpeechModelV4 {
  readonly specificationVersion = 'v4';

  get provider(): string {
    return this.config.provider;
  }

  static [WORKFLOW_SERIALIZE](model: FalSpeechModel) {
    return serializeModelOptions({
      modelId: model.modelId,
      config: model.config,
    });
  }

  static [WORKFLOW_DESERIALIZE](options: {
    modelId: FalSpeechModelId;
    config: FalSpeechModelConfig;
  }) {
    return new FalSpeechModel(options.modelId, options.config);
  }

  constructor(
    readonly modelId: FalSpeechModelId,
    private readonly config: FalSpeechModelConfig,
  ) {}

  private async getArgs({
    text,
    voice,
    outputFormat,
    speed,
    language,
    providerOptions,
  }: Parameters<SpeechModelV4['doGenerate']>[0]) {
    const warnings: SharedV4Warning[] = [];

    const falOptions = await parseProviderOptions({
      provider: 'fal',
      providerOptions,
      schema: falSpeechModelOptionsSchema,
    });

    const requestBody = {
      text,
      output_format: outputFormat === 'hex' ? 'hex' : 'url',
      voice,
      speed,
      ...falOptions,
    };

    // Language is not directly supported; warn and ignore
    if (language) {
      warnings.push({
        type: 'unsupported',
        feature: 'language',
        details:
          "fal speech models don't support 'language' directly; consider providerOptions.fal.language_boost",
      });
    }

    // warn on invalid values (and on hex until we support hex response handling)
    if (outputFormat && outputFormat !== 'url' && outputFormat !== 'hex') {
      warnings.push({
        type: 'unsupported',
        feature: 'outputFormat',
        details: `Unsupported outputFormat: ${outputFormat}. Using 'url' instead.`,
      });
    }

    return { requestBody, warnings } as const;
  }

  async doGenerate(
    options: Parameters<SpeechModelV4['doGenerate']>[0],
  ): Promise<Awaited<ReturnType<SpeechModelV4['doGenerate']>>> {
    const currentDate = this.config._internal?.currentDate?.() ?? new Date();
    const { requestBody, warnings } = await this.getArgs(options);

    const {
      value: json,
      responseHeaders,
      rawValue,
    } = await postJsonToApi({
      url: this.config.url({
        path: `https://fal.run/${this.modelId}`,
        modelId: this.modelId,
      }),
      headers: combineHeaders(this.config.headers?.(), options.headers),
      body: requestBody,
      failedResponseHandler: falFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        falSpeechResponseSchema,
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    const audioUrl = json.audio.url;
    const { value: audio } = await getFromApi({
      url: audioUrl,
      failedResponseHandler: createStatusCodeErrorResponseHandler(),
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
        body: rawValue,
      },
    };
  }
}

const falSpeechResponseSchema = z.object({
  audio: z.object({ url: z.string() }),
  duration_ms: z.number().optional(),
  request_id: z.string().optional(),
});
