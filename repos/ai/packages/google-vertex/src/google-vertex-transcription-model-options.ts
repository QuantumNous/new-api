import { z } from 'zod/v4';

// Google Cloud Speech-to-Text transcription models (Speech-to-Text v2).
// https://docs.cloud.google.com/speech-to-text/docs/transcription-model
export type GoogleVertexTranscriptionModelId =
  | 'chirp_2'
  | 'chirp_3'
  | 'telephony'
  | (string & {});

export const googleVertexTranscriptionProviderOptionsSchema = z.object({
  /**
   * BCP-47 language codes to recognize (e.g. `['en-US']`), or `['auto']` to let
   * Chirp auto-detect the spoken language. Defaults to `['auto']`. For
   * `telephony`, pass a supported explicit language code.
   */
  languageCodes: z.array(z.string()).optional(),

  /**
   * Whether to add punctuation to the transcript. Defaults to `true`.
   */
  enableAutomaticPunctuation: z.boolean().optional(),

  /**
   * Whether to include word-level timestamps. Defaults to `true` so the
   * transcription result can include segments.
   *
   * Enabling word-level timestamps can reduce transcription quality and speed
   * for Chirp models.
   */
  enableWordTimeOffsets: z.boolean().optional(),

  /**
   * The Cloud Speech-to-Text region for the request (e.g. `'us'`, `'eu'`,
   * `'us-central1'`). Defaults to the provider `location`.
   *
   * Note: Speech-to-Text regions differ from Vertex AI regions. Chirp is only
   * available in specific Speech-to-Text regions and is not available in the
   * `global` location.
   */
  region: z.string().optional(),
});

export type GoogleVertexTranscriptionModelOptions = z.infer<
  typeof googleVertexTranscriptionProviderOptionsSchema
>;
