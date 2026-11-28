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
import type { CartesiaConfig } from './cartesia-config';
import { cartesiaFailedResponseHandler } from './cartesia-error';
import { cartesiaSpeechModelOptionsSchema } from './cartesia-speech-model-options';
import type {
  CartesiaSpeechAPITypes,
  CartesiaSpeechBitRate,
  CartesiaSpeechEncoding,
  CartesiaSpeechOutputFormat,
  CartesiaSpeechSampleRate,
} from './cartesia-speech-api-types';
import type {
  CartesiaSpeechModelId,
  CartesiaSpeechVoiceId,
} from './cartesia-speech-options';

interface CartesiaSpeechModelConfig extends CartesiaConfig {
  _internal?: {
    currentDate?: () => Date;
  };
}

// Default output format used when no outputFormat / provider options are set.
const DEFAULT_OUTPUT_FORMAT: CartesiaSpeechAPITypes['output_format'] = {
  container: 'mp3',
  sample_rate: 44100,
  bit_rate: 128000,
};

const OUTPUT_FORMATS: Record<string, CartesiaSpeechOutputFormat> = {
  alaw: { container: 'raw', encoding: 'pcm_alaw', sample_rate: 8000 },
  mp3: DEFAULT_OUTPUT_FORMAT,
  mulaw: { container: 'raw', encoding: 'pcm_mulaw', sample_rate: 8000 },
  pcm: { container: 'raw', encoding: 'pcm_f32le', sample_rate: 44100 },
  raw: { container: 'raw', encoding: 'pcm_f32le', sample_rate: 44100 },
  wav: { container: 'wav', encoding: 'pcm_s16le', sample_rate: 44100 },
};

const SAMPLE_RATES = [8000, 16000, 22050, 24000, 44100, 48000] as const;

function isSampleRate(value: number): value is CartesiaSpeechSampleRate {
  return SAMPLE_RATES.includes(value as CartesiaSpeechSampleRate);
}

function resolveOutputFormat({
  outputFormat,
  providerOptions,
  warnings,
}: {
  outputFormat: string;
  providerOptions:
    | {
        container?: 'raw' | 'wav' | 'mp3' | null;
        encoding?: CartesiaSpeechEncoding | null;
        sampleRate?: CartesiaSpeechSampleRate | null;
        bitRate?: CartesiaSpeechBitRate | null;
      }
    | undefined;
  warnings: SharedV4Warning[];
}): CartesiaSpeechOutputFormat {
  const [formatName, sampleRateText, ...extraParts] = outputFormat
    .toLowerCase()
    .split('_');
  const mapped = OUTPUT_FORMATS[formatName];
  let resolved = mapped ? { ...mapped } : { ...DEFAULT_OUTPUT_FORMAT };

  if (!mapped) {
    warnings.push({
      type: 'unsupported',
      feature: 'outputFormat',
      details: `Unknown output format "${outputFormat}". Falling back to mp3. Use providerOptions.cartesia to configure container, encoding, and sampleRate directly.`,
    });
  } else if (sampleRateText != null) {
    const parsedRate = Number(sampleRateText);
    if (
      extraParts.length === 0 &&
      Number.isInteger(parsedRate) &&
      isSampleRate(parsedRate)
    ) {
      resolved.sample_rate = parsedRate;
    } else {
      warnings.push({
        type: 'unsupported',
        feature: 'outputFormat',
        details: `Unsupported Cartesia sample rate in output format "${outputFormat}". Using ${resolved.sample_rate} Hz instead.`,
      });
    }
  }

  const container = providerOptions?.container ?? resolved.container;
  const sampleRate = providerOptions?.sampleRate ?? resolved.sample_rate;

  if (container === 'mp3') {
    if (providerOptions?.encoding != null) {
      warnings.push({
        type: 'unsupported',
        feature: 'providerOptions.cartesia.encoding',
        details:
          'Cartesia MP3 output does not accept an encoding. The encoding option was ignored.',
      });
    }

    return {
      container,
      sample_rate: sampleRate,
      bit_rate:
        providerOptions?.bitRate ??
        (resolved.container === 'mp3' ? resolved.bit_rate : 128000),
    };
  }

  if (providerOptions?.bitRate != null) {
    warnings.push({
      type: 'unsupported',
      feature: 'providerOptions.cartesia.bitRate',
      details:
        'Cartesia raw and WAV output do not accept a bit rate. The bitRate option was ignored.',
    });
  }

  return {
    container,
    encoding:
      providerOptions?.encoding ??
      (resolved.container === 'mp3'
        ? container === 'wav'
          ? 'pcm_s16le'
          : 'pcm_f32le'
        : resolved.encoding),
    sample_rate: sampleRate,
  };
}

export class CartesiaSpeechModel implements SpeechModelV4 {
  readonly specificationVersion = 'v4';

  get provider(): string {
    return this.config.provider;
  }

  static [WORKFLOW_SERIALIZE](model: CartesiaSpeechModel) {
    return serializeModelOptions({
      modelId: model.modelId,
      config: model.config,
    });
  }

  static [WORKFLOW_DESERIALIZE](options: {
    modelId: CartesiaSpeechModelId;
    config: CartesiaSpeechModelConfig;
  }) {
    return new CartesiaSpeechModel(options.modelId, options.config);
  }

  constructor(
    readonly modelId: CartesiaSpeechModelId,
    private readonly config: CartesiaSpeechModelConfig,
  ) {}

  private async getArgs({
    text,
    voice,
    outputFormat = 'mp3',
    instructions,
    language,
    speed,
    providerOptions,
  }: Parameters<SpeechModelV4['doGenerate']>[0]) {
    const warnings: SharedV4Warning[] = [];

    // Parse provider options
    const cartesiaOptions = await parseProviderOptions({
      provider: 'cartesia',
      providerOptions,
      schema: cartesiaSpeechModelOptionsSchema,
    });

    if (!voice) {
      throw new Error('Cartesia speech models require a `voice` to be set.');
    }

    const outputFormatObject = resolveOutputFormat({
      outputFormat,
      providerOptions: cartesiaOptions,
      warnings,
    });

    // Create request body
    const requestBody: CartesiaSpeechAPITypes = {
      model_id: this.modelId,
      transcript: text,
      voice: {
        mode: 'id',
        id: voice as CartesiaSpeechVoiceId,
      },
      output_format: outputFormatObject,
    };

    // Map generic language
    if (language) {
      requestBody.language = language;
    }

    // Provider-specific options override the corresponding generic options.
    if (cartesiaOptions) {
      if (cartesiaOptions.language != null) {
        requestBody.language = cartesiaOptions.language;
      }
    }

    const resolvedSpeed = cartesiaOptions?.speed ?? speed;
    if (resolvedSpeed != null) {
      if (resolvedSpeed >= 0.6 && resolvedSpeed <= 1.5) {
        requestBody.generation_config = { speed: resolvedSpeed };
      } else {
        warnings.push({
          type: 'unsupported',
          feature: 'speed',
          details:
            'Cartesia speed must be between 0.6 and 1.5. The speed option was ignored.',
        });
      }
    }

    if (instructions) {
      warnings.push({
        type: 'unsupported',
        feature: 'instructions',
        details: `Cartesia speech models do not support instructions. Instructions parameter was ignored.`,
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
        path: '/tts/bytes',
        modelId: this.modelId,
      }),
      headers: combineHeaders(this.config.headers?.(), options.headers),
      body: requestBody,
      failedResponseHandler: cartesiaFailedResponseHandler,
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
