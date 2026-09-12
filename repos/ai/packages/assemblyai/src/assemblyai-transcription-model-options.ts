import { z } from 'zod/v4';

// https://www.assemblyai.com/docs/api-reference/transcripts/submit
export const assemblyaiTranscriptionModelOptionsSchema = z.object({
  /**
   * End time of the audio in milliseconds.
   */
  audioEndAt: z.number().int().nullish(),
  /**
   * Start time of the audio in milliseconds.
   */
  audioStartFrom: z.number().int().nullish(),
  /**
   * Whether to automatically generate chapters for the transcription.
   */
  autoChapters: z.boolean().nullish(),
  /**
   * Whether to automatically generate highlights for the transcription.
   */
  autoHighlights: z.boolean().nullish(),
  /**
   * Boost parameter for word boost (used with `wordBoost`).
   * Allowed values: 'low', 'default', 'high'.
   *
   * @deprecated Only applies to the deprecated `wordBoost` option. Use
   * `keytermsPrompt` instead, which works with the recommended `universal-*`
   * models.
   */
  boostParam: z.string().nullish(),
  /**
   * Whether to enable content safety filtering.
   */
  contentSafety: z.boolean().nullish(),
  /**
   * Confidence threshold for content safety filtering (25-100).
   */
  contentSafetyConfidence: z.number().int().min(25).max(100).nullish(),
  /**
   * Custom spelling rules for the transcription.
   */
  customSpelling: z
    .array(
      z.object({
        from: z.array(z.string()),
        to: z.string(),
      }),
    )
    .nullish(),
  /**
   * Whether to include filler words (um, uh, etc.) in the transcription.
   */
  disfluencies: z.boolean().nullish(),
  /**
   * Enable a domain-specific model to improve accuracy for specialized
   * terminology. Currently supports `'medical-v1'` (Medical Mode).
   */
  domain: z.string().nullish(),
  /**
   * Whether to enable entity detection.
   */
  entityDetection: z.boolean().nullish(),
  /**
   * Whether to filter profanity from the transcription.
   */
  filterProfanity: z.boolean().nullish(),
  /**
   * Whether to format text with punctuation and capitalization.
   */
  formatText: z.boolean().nullish(),
  /**
   * Whether to enable IAB categories detection.
   */
  iabCategories: z.boolean().nullish(),
  /**
   * Domain-specific keyterms to boost recognition for (max 6 words per phrase).
   * Replaces `wordBoost` for newer models: supported by `universal-3-pro` /
   * `universal-3-5-pro` and `slam-1` (and `universal-2` when metaphone is
   * enabled for the account).
   */
  keytermsPrompt: z.array(z.string()).nullish(),
  /**
   * Language code for the transcription.
   */
  languageCode: z.union([z.literal('en'), z.string()]).nullish(),
  /**
   * Confidence threshold for language detection.
   */
  languageConfidenceThreshold: z.number().nullish(),
  /**
   * Whether to enable language detection.
   */
  languageDetection: z.boolean().nullish(),
  /**
   * Options for automatic language detection.
   */
  languageDetectionOptions: z
    .object({
      /** List of languages expected in the audio file. */
      expectedLanguages: z.array(z.string()).nullish(),
      /** Fallback language if the detected language is not expected. */
      fallbackLanguage: z.string().nullish(),
      /** Whether code switching should be detected. */
      codeSwitching: z.boolean().nullish(),
      /** Confidence threshold for code switching detection (0-1). */
      codeSwitchingConfidenceThreshold: z.number().min(0).max(1).nullish(),
    })
    .nullish(),
  /**
   * Whether to process audio as multichannel.
   */
  multichannel: z.boolean().nullish(),
  /**
   * Provide natural-language context (up to 1,500 words) to steer the model.
   * Only supported by `universal-3-pro` / `universal-3-5-pro` and `slam-1`.
   */
  prompt: z.string().nullish(),
  /**
   * Whether to add punctuation to the transcription.
   */
  punctuate: z.boolean().nullish(),
  /**
   * Whether to redact personally identifiable information (PII).
   */
  redactPii: z.boolean().nullish(),
  /**
   * Whether to redact PII in the audio file.
   */
  redactPiiAudio: z.boolean().nullish(),
  /**
   * Options for PII-redacted audio files. Requires `redactPiiAudio`.
   */
  redactPiiAudioOptions: z
    .object({
      /** Return redacted audio even for files without detected speech. */
      returnRedactedNoSpeechAudio: z.boolean().nullish(),
      /** Redaction method; set to `'silence'` to replace PII with silence. */
      overrideAudioRedactionMethod: z.enum(['silence']).nullish(),
    })
    .nullish(),
  /**
   * Audio format for PII redaction.
   */
  redactPiiAudioQuality: z.string().nullish(),
  /**
   * List of PII types to redact.
   */
  redactPiiPolicies: z.array(z.string()).nullish(),
  /**
   * Return the original unredacted transcript alongside the redacted one.
   * Requires `redactPii`.
   */
  redactPiiReturnUnredacted: z.boolean().nullish(),
  /**
   * Substitution method for redacted PII.
   */
  redactPiiSub: z.string().nullish(),
  /**
   * Map of user-defined labels to exact terms to redact, e.g.
   * `{ INTERNAL_TOOL: ['Bearclaw'] }`. Applied on top of standard PII redaction
   * using `redactPiiSub`. Requires `redactPii`.
   */
  redactStaticEntities: z.record(z.string(), z.array(z.string())).nullish(),
  /**
   * Remove inline annotations from rich transcripts. `'all'` removes all inline
   * annotations; `'speaker'` removes only speaker cues. Universal-3 Pro models.
   */
  removeAudioTags: z.enum(['all', 'speaker']).nullish(),
  /**
   * Whether to enable sentiment analysis.
   */
  sentimentAnalysis: z.boolean().nullish(),
  /**
   * Whether to identify different speakers in the audio.
   */
  speakerLabels: z.boolean().nullish(),
  /**
   * Options for speaker diarization, e.g. a range of possible speakers.
   */
  speakerOptions: z
    .object({
      /** Minimum number of speakers expected in the audio file. */
      minSpeakersExpected: z.number().int().nullish(),
      /** Maximum number of speakers expected in the audio file. */
      maxSpeakersExpected: z.number().int().nullish(),
    })
    .nullish(),
  /**
   * Number of speakers expected in the audio.
   */
  speakersExpected: z.number().int().nullish(),
  /**
   * Threshold for speech detection (0-1).
   */
  speechThreshold: z.number().min(0).max(1).nullish(),
  /**
   * Whether to generate a summary of the transcription.
   */
  summarization: z.boolean().nullish(),
  /**
   * Model to use for summarization.
   */
  summaryModel: z.string().nullish(),
  /**
   * Type of summary to generate.
   */
  summaryType: z.string().nullish(),
  /**
   * Sampling temperature (0-1) controlling randomness. Universal-3 Pro models.
   */
  temperature: z.number().min(0).max(1).nullish(),
  /**
   * Name of the authentication header for webhook requests.
   */
  webhookAuthHeaderName: z.string().nullish(),
  /**
   * Value of the authentication header for webhook requests.
   */
  webhookAuthHeaderValue: z.string().nullish(),
  /**
   * URL to send webhook notifications to.
   */
  webhookUrl: z.string().nullish(),
  /**
   * List of words to boost recognition for.
   *
   * @deprecated `wordBoost` is rejected by `universal-3-pro` /
   * `universal-3-5-pro` and `slam-1` (it only works on `universal-2`/`best`).
   * Use `keytermsPrompt` instead.
   */
  wordBoost: z.array(z.string()).nullish(),
});

export type AssemblyAITranscriptionModelOptions = z.infer<
  typeof assemblyaiTranscriptionModelOptionsSchema
>;
