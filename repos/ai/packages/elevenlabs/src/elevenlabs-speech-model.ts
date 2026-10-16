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
import type { ElevenLabsConfig } from './elevenlabs-config';
import { elevenlabsFailedResponseHandler } from './elevenlabs-error';
import { elevenLabsSpeechModelOptionsSchema } from './elevenlabs-speech-model-options';
import type { ElevenLabsSpeechAPITypes } from './elevenlabs-speech-api-types';
import type {
  ElevenLabsSpeechModelId,
  ElevenLabsSpeechVoiceId,
} from './elevenlabs-speech-options';

interface ElevenLabsSpeechModelConfig extends ElevenLabsConfig {
  _internal?: {
    currentDate?: () => Date;
  };
}

export class ElevenLabsSpeechModel implements SpeechModelV4 {
  readonly specificationVersion = 'v4';

  get provider(): string {
    return this.config.provider;
  }

  static [WORKFLOW_SERIALIZE](model: ElevenLabsSpeechModel) {
    return serializeModelOptions({
      modelId: model.modelId,
      config: model.config,
    });
  }

  static [WORKFLOW_DESERIALIZE](options: {
    modelId: ElevenLabsSpeechModelId;
    config: ElevenLabsSpeechModelConfig;
  }) {
    return new ElevenLabsSpeechModel(options.modelId, options.config);
  }

  constructor(
    readonly modelId: ElevenLabsSpeechModelId,
    private readonly config: ElevenLabsSpeechModelConfig,
  ) {}

  private async getArgs({
    text,
    voice = '21m00Tcm4TlvDq8ikWAM',
    outputFormat = 'mp3_44100_128',
    instructions,
    language,
    speed,
    providerOptions,
  }: Parameters<SpeechModelV4['doGenerate']>[0]) {
    const warnings: SharedV4Warning[] = [];

    // Parse provider options
    const elevenLabsOptions = await parseProviderOptions({
      provider: 'elevenlabs',
      providerOptions,
      schema: elevenLabsSpeechModelOptionsSchema,
    });

    // Create request body
    const requestBody: ElevenLabsSpeechAPITypes = {
      text,
      model_id: this.modelId,
    };

    // Prepare query parameters
    const queryParams: Record<string, string> = {};

    // Map outputFormat to ElevenLabs format (as query param)
    if (outputFormat) {
      const formatMap: Record<string, string> = {
        mp3: 'mp3_44100_128',
        mp3_32: 'mp3_44100_32',
        mp3_64: 'mp3_44100_64',
        mp3_96: 'mp3_44100_96',
        mp3_128: 'mp3_44100_128',
        mp3_192: 'mp3_44100_192',
        pcm: 'pcm_44100',
        pcm_16000: 'pcm_16000',
        pcm_22050: 'pcm_22050',
        pcm_24000: 'pcm_24000',
        pcm_44100: 'pcm_44100',
        ulaw: 'ulaw_8000',
      };

      const mappedFormat = formatMap[outputFormat] || outputFormat;
      queryParams.output_format = mappedFormat;
    }

    // Add language code if provided
    if (language) {
      requestBody.language_code = language;
    }

    const voiceSettings: typeof requestBody.voice_settings = {};

    if (speed != null) {
      voiceSettings.speed = speed;
    }

    // Add provider-specific options - map from camelCase to snake_case
    if (elevenLabsOptions) {
      if (elevenLabsOptions.voiceSettings) {
        // Map camelCase voice settings to snake_case for API
        if (elevenLabsOptions.voiceSettings.stability != null) {
          voiceSettings.stability = elevenLabsOptions.voiceSettings.stability;
        }
        if (elevenLabsOptions.voiceSettings.similarityBoost != null) {
          voiceSettings.similarity_boost =
            elevenLabsOptions.voiceSettings.similarityBoost;
        }
        if (elevenLabsOptions.voiceSettings.style != null) {
          voiceSettings.style = elevenLabsOptions.voiceSettings.style;
        }
        if (elevenLabsOptions.voiceSettings.useSpeakerBoost != null) {
          voiceSettings.use_speaker_boost =
            elevenLabsOptions.voiceSettings.useSpeakerBoost;
        }
      }
      // Add language code from provider options if not already set
      if (elevenLabsOptions.languageCode && !requestBody.language_code) {
        requestBody.language_code = elevenLabsOptions.languageCode;
      }

      // Map pronunciation dictionary locators
      if (elevenLabsOptions.pronunciationDictionaryLocators) {
        requestBody.pronunciation_dictionary_locators =
          elevenLabsOptions.pronunciationDictionaryLocators.map(locator => ({
            pronunciation_dictionary_id: locator.pronunciationDictionaryId,
            ...(locator.versionId && { version_id: locator.versionId }),
          }));
      }

      if (elevenLabsOptions.seed != null) {
        requestBody.seed = elevenLabsOptions.seed;
      }
      if (elevenLabsOptions.previousText) {
        requestBody.previous_text = elevenLabsOptions.previousText;
      }
      if (elevenLabsOptions.nextText) {
        requestBody.next_text = elevenLabsOptions.nextText;
      }

      // Add previous and next request IDs
      if (elevenLabsOptions.previousRequestIds) {
        requestBody.previous_request_ids = elevenLabsOptions.previousRequestIds;
      }
      if (elevenLabsOptions.nextRequestIds) {
        requestBody.next_request_ids = elevenLabsOptions.nextRequestIds;
      }

      // Add text normalization options
      if (elevenLabsOptions.applyTextNormalization) {
        requestBody.apply_text_normalization =
          elevenLabsOptions.applyTextNormalization;
      }
      if (elevenLabsOptions.applyLanguageTextNormalization != null) {
        requestBody.apply_language_text_normalization =
          elevenLabsOptions.applyLanguageTextNormalization;
      }

      // enable_logging is a query parameter
      if (elevenLabsOptions.enableLogging != null) {
        queryParams.enable_logging = String(elevenLabsOptions.enableLogging);
      }
    }

    // Only add voice_settings if there are settings to add
    if (Object.keys(voiceSettings).length > 0) {
      requestBody.voice_settings = voiceSettings;
    }

    if (instructions) {
      warnings.push({
        type: 'unsupported',
        feature: 'instructions',
        details: `ElevenLabs speech models do not support instructions. Instructions parameter was ignored.`,
      });
    }

    return {
      requestBody,
      queryParams,
      warnings,
      voiceId: voice as ElevenLabsSpeechVoiceId,
    };
  }

  async doGenerate(
    options: Parameters<SpeechModelV4['doGenerate']>[0],
  ): Promise<Awaited<ReturnType<SpeechModelV4['doGenerate']>>> {
    const currentDate = this.config._internal?.currentDate?.() ?? new Date();
    const { requestBody, queryParams, warnings, voiceId } =
      await this.getArgs(options);

    const {
      value: audio,
      responseHeaders,
      rawValue: rawResponse,
    } = await postJsonToApi({
      url: (() => {
        const baseUrl = this.config.url({
          path: `/v1/text-to-speech/${voiceId}`,
          modelId: this.modelId,
        });
        const queryString = new URLSearchParams(queryParams).toString();
        return queryString ? `${baseUrl}?${queryString}` : baseUrl;
      })(),
      headers: combineHeaders(this.config.headers?.(), options.headers),
      body: requestBody,
      failedResponseHandler: elevenlabsFailedResponseHandler,
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
