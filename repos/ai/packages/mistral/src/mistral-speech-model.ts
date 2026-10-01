import type { SharedV4Warning, SpeechModelV4 } from '@ai-sdk/provider';
import {
  combineHeaders,
  createJsonResponseHandler,
  parseProviderOptions,
  postToApi,
  serializeModelOptions,
  WORKFLOW_DESERIALIZE,
  WORKFLOW_SERIALIZE,
  type FetchFunction,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';
import { mistralFailedResponseHandler } from './mistral-error';
import {
  mistralSpeechModelOptions,
  type MistralSpeechModelId,
} from './mistral-speech-model-options';

interface MistralSpeechModelConfig {
  provider: string;
  baseURL: string;
  headers?: () => Record<string, string | undefined>;
  fetch?: FetchFunction;
  _internal?: {
    currentDate?: () => Date;
  };
}

type MistralSpeechOutputFormat = 'pcm' | 'wav' | 'mp3' | 'flac' | 'opus';

export class MistralSpeechModel implements SpeechModelV4 {
  readonly specificationVersion = 'v4';

  static [WORKFLOW_SERIALIZE](model: MistralSpeechModel) {
    return serializeModelOptions({
      modelId: model.modelId,
      config: model.config,
    });
  }

  static [WORKFLOW_DESERIALIZE](options: {
    modelId: MistralSpeechModelId;
    config: MistralSpeechModelConfig;
  }) {
    return new MistralSpeechModel(options.modelId, options.config);
  }

  get provider(): string {
    return this.config.provider;
  }

  constructor(
    readonly modelId: MistralSpeechModelId,
    private readonly config: MistralSpeechModelConfig,
  ) {}

  private async getArgs({
    text,
    voice,
    outputFormat = 'mp3',
    instructions,
    speed,
    language,
    providerOptions,
  }: Parameters<SpeechModelV4['doGenerate']>[0]) {
    const warnings: SharedV4Warning[] = [];
    const mistralOptions = await parseProviderOptions({
      provider: 'mistral',
      providerOptions,
      schema: mistralSpeechModelOptions,
    });

    let responseFormat: MistralSpeechOutputFormat = 'mp3';
    if (['pcm', 'wav', 'mp3', 'flac', 'opus'].includes(outputFormat)) {
      responseFormat = outputFormat as MistralSpeechOutputFormat;
    } else {
      warnings.push({
        type: 'unsupported',
        feature: 'outputFormat',
        details: `Unsupported output format: ${outputFormat}. Using mp3 instead.`,
      });
    }

    if (instructions != null) {
      warnings.push({
        type: 'unsupported',
        feature: 'instructions',
        details:
          'Mistral speech models do not support the `instructions` option. ' +
          'Use a reference audio clip to guide delivery.',
      });
    }

    if (speed != null) {
      warnings.push({
        type: 'unsupported',
        feature: 'speed',
        details:
          'Mistral speech models do not support the `speed` option. It was ignored.',
      });
    }

    if (language != null) {
      warnings.push({
        type: 'unsupported',
        feature: 'language',
        details:
          'Mistral speech models do not support the `language` option. ' +
          'Language is inferred from the input text and voice.',
      });
    }

    const refAudio = mistralOptions?.refAudio;
    const requestBody = {
      model: this.modelId,
      input: text,
      voice_id: refAudio == null ? voice : undefined,
      ref_audio: refAudio,
      response_format: responseFormat,
      stream: false,
    };

    const requestBodyValues = {
      ...requestBody,
      ref_audio: refAudio == null ? undefined : '[redacted]',
    };

    return { requestBody, requestBodyValues, warnings };
  }

  async doGenerate(
    options: Parameters<SpeechModelV4['doGenerate']>[0],
  ): Promise<Awaited<ReturnType<SpeechModelV4['doGenerate']>>> {
    const currentDate = this.config._internal?.currentDate?.() ?? new Date();
    const { requestBody, requestBodyValues, warnings } =
      await this.getArgs(options);

    const {
      value: response,
      responseHeaders,
      rawValue: rawResponse,
    } = await postToApi({
      url: `${this.config.baseURL}/audio/speech`,
      headers: combineHeaders(
        { 'Content-Type': 'application/json' },
        this.config.headers?.(),
        options.headers,
      ),
      body: {
        content: JSON.stringify(requestBody),
        values: requestBodyValues,
      },
      failedResponseHandler: mistralFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        mistralSpeechResponseSchema,
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    return {
      audio: response.audio_data,
      warnings,
      request: {
        body: JSON.stringify(requestBodyValues),
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

const mistralSpeechResponseSchema = z.object({
  audio_data: z.string(),
});
