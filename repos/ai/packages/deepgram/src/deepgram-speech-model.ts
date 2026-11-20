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
import type { DeepgramConfig } from './deepgram-config';
import { deepgramFailedResponseHandler } from './deepgram-error';
import { deepgramSpeechModelOptionsSchema } from './deepgram-speech-model-options';
import type { DeepgramSpeechModelId } from './deepgram-speech-options';

interface DeepgramSpeechModelConfig extends DeepgramConfig {
  _internal?: {
    currentDate?: () => Date;
  };
}

export class DeepgramSpeechModel implements SpeechModelV4 {
  readonly specificationVersion = 'v4';

  get provider(): string {
    return this.config.provider;
  }

  static [WORKFLOW_SERIALIZE](model: DeepgramSpeechModel) {
    return serializeModelOptions({
      modelId: model.modelId,
      config: model.config,
    });
  }

  static [WORKFLOW_DESERIALIZE](options: {
    modelId: DeepgramSpeechModelId;
    config: DeepgramSpeechModelConfig;
  }) {
    return new DeepgramSpeechModel(options.modelId, options.config);
  }

  constructor(
    readonly modelId: DeepgramSpeechModelId,
    private readonly config: DeepgramSpeechModelConfig,
  ) {}

  private async getArgs({
    text,
    voice,
    outputFormat = 'mp3',
    speed,
    language,
    instructions,
    providerOptions,
  }: Parameters<SpeechModelV4['doGenerate']>[0]) {
    const warnings: SharedV4Warning[] = [];

    // Parse provider options
    const deepgramOptions = await parseProviderOptions({
      provider: 'deepgram',
      providerOptions,
      schema: deepgramSpeechModelOptionsSchema,
    });

    // Create request body
    const requestBody = {
      text,
    };

    // Prepare query parameters
    const queryParams: Record<string, string> = {
      model: this.modelId,
    };

    // Map outputFormat to encoding/container/sample_rate
    // https://developers.deepgram.com/docs/tts-media-output-settings#audio-format-combinations
    if (outputFormat) {
      const formatLower = outputFormat.toLowerCase();

      // Common format mappings based on Deepgram's valid combinations
      const formatMap: Record<
        string,
        {
          encoding?: string;
          container?: string;
          sampleRate?: number;
          bitRate?: number;
        }
      > = {
        // MP3: no container, fixed 22050 sample rate, bitrate 32000/48000
        mp3: { encoding: 'mp3' }, // Don't set container or sample_rate for mp3
        // Linear16: wav/none container, configurable sample rate
        wav: { container: 'wav', encoding: 'linear16' },
        linear16: { encoding: 'linear16', container: 'wav' },
        // MuLaw: wav/none container, 8000/16000 sample rate
        mulaw: { encoding: 'mulaw', container: 'wav' },
        // ALaw: wav/none container, 8000/16000 sample rate
        alaw: { encoding: 'alaw', container: 'wav' },
        // Opus: ogg container, fixed 48000 sample rate
        opus: { encoding: 'opus', container: 'ogg' },
        ogg: { encoding: 'opus', container: 'ogg' },
        // FLAC: no container, configurable sample rate
        flac: { encoding: 'flac' },
        // AAC: no container, fixed 22050 sample rate
        aac: { encoding: 'aac' },
        // Raw audio (no container)
        pcm: { encoding: 'linear16', container: 'none' },
      };

      const mappedFormat = formatMap[formatLower];
      if (mappedFormat) {
        if (mappedFormat.encoding) {
          queryParams.encoding = mappedFormat.encoding;
        }
        // Only set container if specified and valid for the encoding
        if (mappedFormat.container) {
          queryParams.container = mappedFormat.container;
        }
        // Only set sample_rate if specified and valid for the encoding
        if (mappedFormat.sampleRate) {
          queryParams.sample_rate = String(mappedFormat.sampleRate);
        }
        // Set bitrate for formats that support it
        if (mappedFormat.bitRate) {
          queryParams.bit_rate = String(mappedFormat.bitRate);
        }
      } else {
        // Try to parse format like "wav_44100" or "linear16_24000"
        const parts = formatLower.split('_');
        if (parts.length >= 2) {
          const firstPart = parts[0];
          const secondPart = parts[1];
          const sampleRate = parseInt(secondPart, 10);

          // Check if first part is an encoding
          if (
            [
              'linear16',
              'mulaw',
              'alaw',
              'mp3',
              'opus',
              'flac',
              'aac',
            ].includes(firstPart)
          ) {
            queryParams.encoding = firstPart;

            // Set container based on encoding
            if (['linear16', 'mulaw', 'alaw'].includes(firstPart)) {
              // These can use wav or none, default to wav
              queryParams.container = 'wav';
            } else if (firstPart === 'opus') {
              queryParams.container = 'ogg';
            }
            // mp3, flac, aac don't use container

            // Set sample rate if valid for encoding
            if (!isNaN(sampleRate)) {
              if (
                firstPart === 'linear16' &&
                [8000, 16000, 24000, 32000, 48000].includes(sampleRate)
              ) {
                queryParams.sample_rate = String(sampleRate);
              } else if (
                firstPart === 'mulaw' &&
                [8000, 16000].includes(sampleRate)
              ) {
                queryParams.sample_rate = String(sampleRate);
              } else if (
                firstPart === 'alaw' &&
                [8000, 16000].includes(sampleRate)
              ) {
                queryParams.sample_rate = String(sampleRate);
              } else if (
                firstPart === 'flac' &&
                [8000, 16000, 22050, 32000, 48000].includes(sampleRate)
              ) {
                queryParams.sample_rate = String(sampleRate);
              }
              // mp3, opus, aac have fixed sample rates, don't set
            }
          } else if (['wav', 'ogg'].includes(firstPart)) {
            // First part is container
            if (firstPart === 'wav') {
              queryParams.container = 'wav';
              queryParams.encoding = 'linear16'; // Default encoding for wav
            } else if (firstPart === 'ogg') {
              queryParams.container = 'ogg';
              queryParams.encoding = 'opus'; // Default encoding for ogg
            }
            if (!isNaN(sampleRate)) {
              queryParams.sample_rate = String(sampleRate);
            }
          }
        }
      }
    }

    // Add provider-specific options - map camelCase to snake_case
    // Validate combinations according to Deepgram's spec
    if (deepgramOptions) {
      if (deepgramOptions.encoding) {
        const newEncoding = deepgramOptions.encoding.toLowerCase();

        // If encoding changes, we may need to clear incompatible parameters
        queryParams.encoding = newEncoding;

        // Validate container based on encoding
        if (deepgramOptions.container) {
          // Validate container is valid for this encoding
          if (['linear16', 'mulaw', 'alaw'].includes(newEncoding)) {
            if (
              !['wav', 'none'].includes(deepgramOptions.container.toLowerCase())
            ) {
              warnings.push({
                type: 'unsupported',
                feature: 'providerOptions',
                details: `Encoding "${newEncoding}" only supports containers "wav" or "none". Container "${deepgramOptions.container}" was ignored.`,
              });
            } else {
              queryParams.container = deepgramOptions.container.toLowerCase();
            }
          } else if (newEncoding === 'opus') {
            // opus requires ogg container, override any previous container setting
            queryParams.container = 'ogg';
          } else if (['mp3', 'flac', 'aac'].includes(newEncoding)) {
            warnings.push({
              type: 'unsupported',
              feature: 'providerOptions',
              details: `Encoding "${newEncoding}" does not support container parameter. Container "${deepgramOptions.container}" was ignored.`,
            });
            // Remove container if it was set by outputFormat
            delete queryParams.container;
          }
        } else {
          // No container specified in providerOptions
          // If encoding changed to one that doesn't support container, remove it
          if (['mp3', 'flac', 'aac'].includes(newEncoding)) {
            delete queryParams.container;
          } else if (['linear16', 'mulaw', 'alaw'].includes(newEncoding)) {
            // Set default container if not already set
            if (!queryParams.container) {
              queryParams.container = 'wav'; // Default for these encodings
            }
          } else if (newEncoding === 'opus') {
            // opus requires ogg container, override any previous container setting
            queryParams.container = 'ogg';
          }
        }

        // Clean up sample_rate and bit_rate if they're incompatible with the new encoding
        // Fixed sample rate encodings (mp3, opus, aac) don't support sample_rate parameter
        if (['mp3', 'opus', 'aac'].includes(newEncoding)) {
          delete queryParams.sample_rate;
        }
        // Lossless encodings without bitrate support (linear16, mulaw, alaw, flac) don't support bit_rate
        if (['linear16', 'mulaw', 'alaw', 'flac'].includes(newEncoding)) {
          delete queryParams.bit_rate;
        }
      } else if (deepgramOptions.container) {
        // Container specified without encoding - set default encoding
        const container = deepgramOptions.container.toLowerCase();
        const oldEncoding = queryParams.encoding?.toLowerCase();
        let newEncoding: string | undefined;

        if (container === 'wav') {
          queryParams.container = 'wav';
          newEncoding = 'linear16'; // Default encoding for wav
        } else if (container === 'ogg') {
          queryParams.container = 'ogg';
          newEncoding = 'opus'; // Default encoding for ogg
        } else if (container === 'none') {
          queryParams.container = 'none';
          newEncoding = 'linear16'; // Default encoding for raw audio
        }

        // If encoding changed, clean up incompatible parameters
        if (newEncoding && newEncoding !== oldEncoding) {
          queryParams.encoding = newEncoding;
          // Clean up sample_rate and bit_rate if they're incompatible with the new encoding
          if (['mp3', 'opus', 'aac'].includes(newEncoding)) {
            delete queryParams.sample_rate;
          }
          if (['linear16', 'mulaw', 'alaw', 'flac'].includes(newEncoding)) {
            delete queryParams.bit_rate;
          }
        }
      }

      if (deepgramOptions.sampleRate != null) {
        const encoding = queryParams.encoding?.toLowerCase() || '';
        const sampleRate = deepgramOptions.sampleRate;

        // Validate sample rate based on encoding
        if (encoding === 'linear16') {
          if (![8000, 16000, 24000, 32000, 48000].includes(sampleRate)) {
            warnings.push({
              type: 'unsupported',
              feature: 'providerOptions',
              details: `Encoding "linear16" only supports sample rates: 8000, 16000, 24000, 32000, 48000. Sample rate ${sampleRate} was ignored.`,
            });
          } else {
            queryParams.sample_rate = String(sampleRate);
          }
        } else if (encoding === 'mulaw' || encoding === 'alaw') {
          if (![8000, 16000].includes(sampleRate)) {
            warnings.push({
              type: 'unsupported',
              feature: 'providerOptions',
              details: `Encoding "${encoding}" only supports sample rates: 8000, 16000. Sample rate ${sampleRate} was ignored.`,
            });
          } else {
            queryParams.sample_rate = String(sampleRate);
          }
        } else if (encoding === 'flac') {
          if (![8000, 16000, 22050, 32000, 48000].includes(sampleRate)) {
            warnings.push({
              type: 'unsupported',
              feature: 'providerOptions',
              details: `Encoding "flac" only supports sample rates: 8000, 16000, 22050, 32000, 48000. Sample rate ${sampleRate} was ignored.`,
            });
          } else {
            queryParams.sample_rate = String(sampleRate);
          }
        } else if (['mp3', 'opus', 'aac'].includes(encoding)) {
          warnings.push({
            type: 'unsupported',
            feature: 'providerOptions',
            details: `Encoding "${encoding}" has a fixed sample rate and does not support sample_rate parameter. Sample rate ${sampleRate} was ignored.`,
          });
        } else {
          // No encoding set yet, allow it (will be validated when encoding is set)
          queryParams.sample_rate = String(sampleRate);
        }
      }

      if (deepgramOptions.bitRate != null) {
        const encoding = queryParams.encoding?.toLowerCase() || '';
        const bitRate = deepgramOptions.bitRate;

        // Validate bitrate based on encoding
        if (encoding === 'mp3') {
          if (![32000, 48000].includes(Number(bitRate))) {
            warnings.push({
              type: 'unsupported',
              feature: 'providerOptions',
              details: `Encoding "mp3" only supports bit rates: 32000, 48000. Bit rate ${bitRate} was ignored.`,
            });
          } else {
            queryParams.bit_rate = String(bitRate);
          }
        } else if (encoding === 'opus') {
          const bitRateNum = Number(bitRate);
          if (bitRateNum < 4000 || bitRateNum > 650000) {
            warnings.push({
              type: 'unsupported',
              feature: 'providerOptions',
              details: `Encoding "opus" supports bit rates between 4000 and 650000. Bit rate ${bitRate} was ignored.`,
            });
          } else {
            queryParams.bit_rate = String(bitRate);
          }
        } else if (encoding === 'aac') {
          const bitRateNum = Number(bitRate);
          if (bitRateNum < 4000 || bitRateNum > 192000) {
            warnings.push({
              type: 'unsupported',
              feature: 'providerOptions',
              details: `Encoding "aac" supports bit rates between 4000 and 192000. Bit rate ${bitRate} was ignored.`,
            });
          } else {
            queryParams.bit_rate = String(bitRate);
          }
        } else if (['linear16', 'mulaw', 'alaw', 'flac'].includes(encoding)) {
          warnings.push({
            type: 'unsupported',
            feature: 'providerOptions',
            details: `Encoding "${encoding}" does not support bit_rate parameter. Bit rate ${bitRate} was ignored.`,
          });
        } else {
          // No encoding set yet, allow it
          queryParams.bit_rate = String(bitRate);
        }
      }

      if (deepgramOptions.callback) {
        queryParams.callback = deepgramOptions.callback;
      }
      if (deepgramOptions.callbackMethod) {
        queryParams.callback_method = deepgramOptions.callbackMethod;
      }
      if (deepgramOptions.mipOptOut != null) {
        queryParams.mip_opt_out = String(deepgramOptions.mipOptOut);
      }
      if (deepgramOptions.tag) {
        if (Array.isArray(deepgramOptions.tag)) {
          queryParams.tag = deepgramOptions.tag.join(',');
        } else {
          queryParams.tag = deepgramOptions.tag;
        }
      }
    }

    // Handle voice parameter - Deepgram embeds voice in model ID
    // If voice is provided and different from model, warn user
    if (voice && voice !== this.modelId) {
      warnings.push({
        type: 'unsupported',
        feature: 'voice',
        details: `Deepgram TTS models embed the voice in the model ID. The voice parameter "${voice}" was ignored. Use the model ID to select a voice (e.g., "aura-2-helena-en").`,
      });
    }

    // Handle speed - not supported in Deepgram REST API
    if (speed != null) {
      warnings.push({
        type: 'unsupported',
        feature: 'speed',
        details: `Deepgram TTS REST API does not support speed adjustment. Speed parameter was ignored.`,
      });
    }

    // Handle language - Deepgram models are language-specific via model ID
    if (language) {
      warnings.push({
        type: 'unsupported',
        feature: 'language',
        details: `Deepgram TTS models are language-specific via the model ID. Language parameter "${language}" was ignored. Select a model with the appropriate language suffix (e.g., "-en" for English).`,
      });
    }

    // Handle instructions - not supported in Deepgram REST API
    if (instructions) {
      warnings.push({
        type: 'unsupported',
        feature: 'instructions',
        details: `Deepgram TTS REST API does not support instructions. Instructions parameter was ignored.`,
      });
    }

    return {
      requestBody,
      queryParams,
      warnings,
    };
  }

  async doGenerate(
    options: Parameters<SpeechModelV4['doGenerate']>[0],
  ): Promise<Awaited<ReturnType<SpeechModelV4['doGenerate']>>> {
    const currentDate = this.config._internal?.currentDate?.() ?? new Date();
    const { requestBody, queryParams, warnings } = await this.getArgs(options);

    const {
      value: audio,
      responseHeaders,
      rawValue: rawResponse,
    } = await postJsonToApi({
      url: (() => {
        const baseUrl = this.config.url({
          path: '/v1/speak',
          modelId: this.modelId,
        });
        const queryString = new URLSearchParams(queryParams).toString();
        return queryString ? `${baseUrl}?${queryString}` : baseUrl;
      })(),
      headers: combineHeaders(this.config.headers?.(), options.headers),
      body: requestBody,
      failedResponseHandler: deepgramFailedResponseHandler,
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
