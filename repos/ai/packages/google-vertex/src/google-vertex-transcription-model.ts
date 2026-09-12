import type { SharedV4Warning, TranscriptionModelV4 } from '@ai-sdk/provider';
import {
  combineHeaders,
  convertUint8ArrayToBase64,
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
import { z } from 'zod/v4';
import { googleVertexFailedResponseHandler } from './google-vertex-error';
import {
  googleVertexTranscriptionProviderOptionsSchema,
  type GoogleVertexTranscriptionModelId,
  type GoogleVertexTranscriptionModelOptions,
} from './google-vertex-transcription-model-options';

interface GoogleVertexTranscriptionModelConfig {
  provider: string;
  /** Google Cloud project id. */
  project: string;
  /** Default Speech-to-Text region (overridable via provider options). */
  location: string;
  headers?: Resolvable<Record<string, string | undefined>>;
  fetch?: FetchFunction;
  _internal?: {
    currentDate?: () => Date;
  };
}

// Speech-to-Text Durations are strings like `"1.200s"`; parse to seconds.
function parseDurationSeconds(
  value: string | null | undefined,
): number | undefined {
  if (value == null) {
    return undefined;
  }
  const seconds = Number.parseFloat(value);
  return Number.isFinite(seconds) ? seconds : undefined;
}

function convertBcp47ToIso6391(
  value: string | null | undefined,
): string | undefined {
  if (value == null) {
    return undefined;
  }

  try {
    const language = new Intl.Locale(value).language;
    return language.length === 2 ? language : undefined;
  } catch {
    return undefined;
  }
}

export class GoogleVertexTranscriptionModel implements TranscriptionModelV4 {
  readonly specificationVersion = 'v4';

  static [WORKFLOW_SERIALIZE](model: GoogleVertexTranscriptionModel) {
    return serializeModelOptions({
      modelId: model.modelId,
      config: model.config,
    });
  }

  static [WORKFLOW_DESERIALIZE](options: {
    modelId: GoogleVertexTranscriptionModelId;
    config: GoogleVertexTranscriptionModelConfig;
  }) {
    return new GoogleVertexTranscriptionModel(options.modelId, options.config);
  }

  get provider(): string {
    return this.config.provider;
  }

  constructor(
    readonly modelId: GoogleVertexTranscriptionModelId,
    private readonly config: GoogleVertexTranscriptionModelConfig,
  ) {}

  async doGenerate(
    options: Parameters<TranscriptionModelV4['doGenerate']>[0],
  ): Promise<Awaited<ReturnType<TranscriptionModelV4['doGenerate']>>> {
    const currentDate = this.config._internal?.currentDate?.() ?? new Date();
    const warnings: SharedV4Warning[] = [];

    // Provider options may be passed under `googleVertex`, `vertex`, or `google`
    // (matching the Vertex language + embedding models).
    let googleOptions: GoogleVertexTranscriptionModelOptions | undefined;
    for (const provider of ['googleVertex', 'vertex', 'google'] as const) {
      googleOptions = await parseProviderOptions({
        provider,
        providerOptions: options.providerOptions,
        schema: googleVertexTranscriptionProviderOptionsSchema,
      });
      if (googleOptions != null) {
        break;
      }
    }

    const region = googleOptions?.region ?? this.config.location;
    const languageCodes = googleOptions?.languageCodes ?? ['auto'];

    // The recognize API takes base64-encoded audio in the `content` field. A
    // string audio input is already base64-encoded per the spec.
    const content =
      typeof options.audio === 'string'
        ? options.audio
        : convertUint8ArrayToBase64(options.audio);

    const requestBody = {
      config: {
        model: this.modelId,
        languageCodes,
        // Let Speech-to-Text auto-detect the audio encoding (wav/mp3/flac/…).
        autoDecodingConfig: {},
        features: {
          // Word timing populates `segments`.
          enableWordTimeOffsets: googleOptions?.enableWordTimeOffsets ?? true,
          enableAutomaticPunctuation:
            googleOptions?.enableAutomaticPunctuation ?? true,
        },
      },
      content,
    };

    const host =
      region === 'global'
        ? 'speech.googleapis.com'
        : `${region}-speech.googleapis.com`;

    const url =
      `https://${host}/v2/projects/` +
      `${this.config.project}/locations/${region}/recognizers/_:recognize`;

    const {
      value: response,
      responseHeaders,
      rawValue: rawResponse,
    } = await postJsonToApi({
      url,
      headers: combineHeaders(
        this.config.headers ? await resolve(this.config.headers) : undefined,
        options.headers,
      ),
      body: requestBody,
      failedResponseHandler: googleVertexFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        googleVertexTranscriptionResponseSchema,
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    // Results are sequential portions of the audio; concatenate their primary
    // alternatives into the full transcript and collect word-level segments.
    const results = response.results ?? [];
    const text = results
      .map(result => result.alternatives?.[0]?.transcript ?? '')
      .join(' ')
      .trim();
    const segments = results.flatMap(
      result =>
        result.alternatives?.[0]?.words?.flatMap(word => {
          const startSecond = parseDurationSeconds(word.startOffset);
          const endSecond = parseDurationSeconds(word.endOffset);

          return word.word == null || startSecond == null || endSecond == null
            ? []
            : [{ text: word.word, startSecond, endSecond }];
        }) ?? [],
    );
    const language = convertBcp47ToIso6391(results[0]?.languageCode);

    return {
      text,
      segments,
      language,
      durationInSeconds: parseDurationSeconds(
        response.metadata?.totalBilledDuration,
      ),
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

// Minimal schema: only the fields the implementation reads, with `.nullish()`
// so provider API changes don't break parsing.
const googleVertexTranscriptionResponseSchema = z.object({
  results: z
    .array(
      z.object({
        alternatives: z
          .array(
            z.object({
              transcript: z.string().nullish(),
              words: z
                .array(
                  z.object({
                    word: z.string().nullish(),
                    startOffset: z.string().nullish(),
                    endOffset: z.string().nullish(),
                  }),
                )
                .nullish(),
            }),
          )
          .nullish(),
        languageCode: z.string().nullish(),
      }),
    )
    .nullish(),
  metadata: z
    .object({
      totalBilledDuration: z.string().nullish(),
    })
    .nullish(),
});
