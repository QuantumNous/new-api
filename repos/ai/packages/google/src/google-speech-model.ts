import type { SpeechModelV4, SharedV4Warning } from '@ai-sdk/provider';
import {
  combineHeaders,
  convertBase64ToUint8Array,
  createJsonResponseHandler,
  parseProviderOptions,
  postJsonToApi,
  resolve,
  serializeModelOptions,
  WORKFLOW_DESERIALIZE,
  WORKFLOW_SERIALIZE,
  type FetchFunction,
  type Resolvable,
} from '@ai-sdk/provider-utils';
import { googleFailedResponseHandler } from './google-error';
import { googleSpeechResponseSchema } from './google-speech-api';
import {
  googleSpeechProviderOptionsSchema,
  type GoogleSpeechModelId,
  type GoogleSpeechModelOptions,
} from './google-speech-model-options';

interface GoogleSpeechModelConfig {
  provider: string;
  baseURL: string;
  headers?: Resolvable<Record<string, string | undefined>>;
  fetch?: FetchFunction;
  _internal?: {
    currentDate?: () => Date;
  };
}

const DEFAULT_VOICE = 'Kore';
// Gemini TTS returns raw PCM at 24kHz when the response does not specify a rate.
const DEFAULT_SAMPLE_RATE = 24000;

export class GoogleSpeechModel implements SpeechModelV4 {
  readonly specificationVersion = 'v4';

  static [WORKFLOW_SERIALIZE](model: GoogleSpeechModel) {
    return serializeModelOptions({
      modelId: model.modelId,
      config: model.config,
    });
  }

  static [WORKFLOW_DESERIALIZE](options: {
    modelId: GoogleSpeechModelId;
    config: GoogleSpeechModelConfig;
  }) {
    return new GoogleSpeechModel(options.modelId, options.config);
  }

  get provider(): string {
    return this.config.provider;
  }

  constructor(
    readonly modelId: GoogleSpeechModelId,
    private readonly config: GoogleSpeechModelConfig,
  ) {}

  private async getArgs({
    text,
    voice = DEFAULT_VOICE,
    outputFormat,
    instructions,
    speed,
    language,
    providerOptions,
  }: Parameters<SpeechModelV4['doGenerate']>[0]) {
    const warnings: SharedV4Warning[] = [];

    // Names to look up in providerOptions. The Vertex provider exposes these
    // under `googleVertex`/`vertex` (matching the Google Vertex language model),
    // while every other Google provider uses `google`.
    const providerOptionsNames: readonly string[] =
      this.config.provider.includes('vertex')
        ? (['googleVertex', 'vertex'] as const)
        : (['google'] as const);

    let googleOptions: GoogleSpeechModelOptions | undefined;
    for (const name of providerOptionsNames) {
      googleOptions = await parseProviderOptions({
        provider: name,
        providerOptions,
        schema: googleSpeechProviderOptionsSchema,
      });
      if (googleOptions != null) {
        break;
      }
    }

    // Cross-namespace fallback: a Vertex provider may receive options under the
    // `google` key (e.g. via the AI Gateway).
    if (googleOptions == null && !providerOptionsNames.includes('google')) {
      googleOptions = await parseProviderOptions({
        provider: 'google',
        providerOptions,
        schema: googleSpeechProviderOptionsSchema,
      });
    }

    // Multi-speaker (provider option) takes precedence over the single voice.
    const multiSpeakerVoiceConfig = googleOptions?.multiSpeakerVoiceConfig;
    const speechConfig = multiSpeakerVoiceConfig
      ? { multiSpeakerVoiceConfig }
      : { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } };

    // Gemini honors natural-language style direction expressed in the prompt
    // text, so map `instructions` onto the spoken content. With multi-speaker
    // the transcript starts with speaker labels (e.g. `Joe: ...`), so prepending
    // instructions would corrupt that parsing — ignore them there (with a warning).
    let promptText = text;
    if (instructions != null) {
      if (multiSpeakerVoiceConfig) {
        warnings.push({
          type: 'unsupported',
          feature: 'instructions',
          details:
            'Google Gemini TTS ignores `instructions` when `multiSpeakerVoiceConfig` is set, ' +
            'because prepending them would break multi-speaker transcript parsing.',
        });
      } else {
        promptText = `${instructions}: ${text}`;
      }
    }

    if (speed != null) {
      warnings.push({
        type: 'unsupported',
        feature: 'speed',
        details:
          'Google Gemini TTS models do not support the `speed` option. It was ignored.',
      });
    }

    if (language != null) {
      warnings.push({
        type: 'unsupported',
        feature: 'language',
        details:
          'Google Gemini TTS models do not support the `language` option. ' +
          'Language is detected automatically from the input text.',
      });
    }

    // Only `wav` (default, WAV-wrapped) and `pcm` (raw) are supported.
    let resolvedOutputFormat: 'wav' | 'pcm' = 'wav';
    if (outputFormat === 'pcm') {
      resolvedOutputFormat = 'pcm';
    } else if (outputFormat != null && outputFormat !== 'wav') {
      warnings.push({
        type: 'unsupported',
        feature: 'outputFormat',
        details: `Unsupported output format: ${outputFormat}. Using wav instead.`,
      });
    }

    const requestBody = {
      contents: [{ role: 'user', parts: [{ text: promptText }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig,
      },
    };

    return { requestBody, warnings, outputFormat: resolvedOutputFormat };
  }

  async doGenerate(
    options: Parameters<SpeechModelV4['doGenerate']>[0],
  ): Promise<Awaited<ReturnType<SpeechModelV4['doGenerate']>>> {
    const currentDate = this.config._internal?.currentDate?.() ?? new Date();
    const { requestBody, warnings, outputFormat } = await this.getArgs(options);

    const {
      value: response,
      responseHeaders,
      rawValue: rawResponse,
    } = await postJsonToApi({
      url: `${this.config.baseURL}/models/${this.modelId}:generateContent`,
      headers: combineHeaders(
        this.config.headers ? await resolve(this.config.headers) : undefined,
        options.headers,
      ),
      body: requestBody,
      failedResponseHandler: googleFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        googleSpeechResponseSchema,
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    // `generateSpeech` returns a single audio result, and Gemini returns one
    // inline audio part per request, so take the first inline-data part.
    let base64Audio: string | undefined;
    let mimeType: string | undefined;
    for (const candidate of response.candidates ?? []) {
      for (const part of candidate.content?.parts ?? []) {
        if (part.inlineData?.data) {
          base64Audio = part.inlineData.data;
          mimeType = part.inlineData.mimeType ?? undefined;
          break;
        }
      }
      if (base64Audio != null) {
        break;
      }
    }

    const sampleRate = parseSampleRate(mimeType) ?? DEFAULT_SAMPLE_RATE;
    const pcm =
      base64Audio != null
        ? convertBase64ToUint8Array(base64Audio)
        : new Uint8Array(0);

    // Gemini returns headerless raw PCM (e.g. `audio/L16;rate=24000`). Unlike
    // providers that return a container format (mp3/opus/wav) directly,
    // `generateSpeech`'s `detectMediaType` can't identify raw PCM and would
    // mislabel it `audio/mp3` (not playable), so wrap it in a minimal WAV header
    // by default; `outputFormat: 'pcm'` returns the raw bytes untouched.
    // Empty audio is returned as-is so the core layer throws NoSpeechGeneratedError.
    const audio =
      outputFormat === 'pcm' || pcm.length === 0
        ? pcm
        : addWavHeader(pcm, sampleRate);

    if (outputFormat === 'pcm' && pcm.length > 0) {
      warnings.push({
        type: 'unsupported',
        feature: 'outputFormat',
        details:
          `Returning raw PCM audio (signed 16-bit little-endian, mono, ${sampleRate} Hz). ` +
          'These bytes have no container header and are not directly playable; ' +
          'see providerMetadata.google for the sample rate and mime type.',
      });
    }

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
      providerMetadata: {
        google: {
          sampleRate,
          mimeType: mimeType ?? null,
        },
      },
    };
  }
}

/**
 * Parses the sample rate from a PCM mime type such as `audio/L16;rate=24000`.
 */
function parseSampleRate(mimeType: string | undefined): number | undefined {
  if (mimeType == null) {
    return undefined;
  }
  const match = /rate=(\d+)/.exec(mimeType);
  return match ? Number.parseInt(match[1], 10) : undefined;
}

/**
 * Wraps raw signed 16-bit little-endian mono PCM in a minimal 44-byte WAV
 * (RIFF/WAVE) container so the output is playable and detectable as `audio/wav`.
 */
function addWavHeader(pcm: Uint8Array, sampleRate: number): Uint8Array {
  const numChannels = 1;
  const bitsPerSample = 16;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcm.length;

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // PCM fmt chunk size
  view.setUint16(20, 1, true); // audio format = PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  const out = new Uint8Array(buffer);
  out.set(pcm, 44);
  return out;
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}
