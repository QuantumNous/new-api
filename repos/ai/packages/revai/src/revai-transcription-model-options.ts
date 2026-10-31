import { z } from 'zod/v4';

// https://docs.rev.ai/api/asynchronous/reference/#operation/SubmitTranscriptionJob
export const revaiTranscriptionModelOptionsSchema = z.object({
  /**
   * Optional metadata string to associate with the transcription job.
   */
  metadata: z.string().nullish(),
  /**
   * Configuration for webhook notifications when job is complete.
   */
  notification_config: z
    .object({
      /**
       * URL to send the notification to.
       */
      url: z.string(),
      /**
       * Optional authorization headers for the notification request.
       */
      auth_headers: z
        .object({
          Authorization: z.string(),
        })
        .nullish(),
    })
    .nullish(),
  /**
   * Number of seconds after which the job will be automatically deleted.
   */
  delete_after_seconds: z.number().nullish(),
  /**
   * Whether to include filler words and false starts in the transcription.
   */
  verbatim: z.boolean().optional(),
  /**
   * Whether to prioritize the job for faster processing.
   */
  rush: z.boolean().nullish().default(false),
  /**
   * Whether to run the job in test mode.
   */
  test_mode: z.boolean().nullish().default(false),
  /**
   * Specific segments of the audio to transcribe.
   */
  segments_to_transcribe: z
    .array(
      z.object({
        /**
         * Start time of the segment in seconds.
         */
        start: z.number(),
        /**
         * End time of the segment in seconds.
         */
        end: z.number(),
      }),
    )
    .nullish(),
  /**
   * Names to assign to speakers in the transcription.
   */
  speaker_names: z
    .array(
      z.object({
        /**
         * Display name for the speaker.
         */
        display_name: z.string(),
      }),
    )
    .nullish(),
  /**
   * Whether to skip speaker diarization.
   */
  skip_diarization: z.boolean().nullish().default(false),
  /**
   * Whether to skip post-processing steps.
   */
  skip_postprocessing: z.boolean().nullish().default(false),
  /**
   * Whether to skip adding punctuation to the transcription.
   */
  skip_punctuation: z.boolean().nullish().default(false),
  /**
   * Whether to remove disfluencies (um, uh, etc.) from the transcription.
   */
  remove_disfluencies: z.boolean().nullish().default(false),
  /**
   * Whether to remove atmospheric sounds from the transcription.
   */
  remove_atmospherics: z.boolean().nullish().default(false),
  /**
   * Whether to filter profanity from the transcription.
   */
  filter_profanity: z.boolean().nullish().default(false),
  /**
   * Number of speaker channels in the audio.
   */
  speaker_channels_count: z.number().nullish(),
  /**
   * Expected number of speakers in the audio.
   */
  speakers_count: z.number().nullish(),
  /**
   * Type of diarization to use.
   */
  diarization_type: z
    .enum(['standard', 'premium'])
    .nullish()
    .default('standard'),
  /**
   * ID of a custom vocabulary to use for the transcription.
   */
  custom_vocabulary_id: z.string().nullish(),
  /**
   * Custom vocabularies to use for the transcription.
   */
  custom_vocabularies: z.array(z.object({})).optional(),
  /**
   * Whether to strictly enforce custom vocabulary.
   */
  strict_custom_vocabulary: z.boolean().optional(),
  /**
   * Configuration for generating a summary of the transcription.
   */
  summarization_config: z
    .object({
      /**
       * Model to use for summarization.
       */
      model: z.enum(['standard', 'premium']).nullish().default('standard'),
      /**
       * Format of the summary.
       */
      type: z.enum(['paragraph', 'bullets']).nullish().default('paragraph'),
      /**
       * Custom prompt for the summarization.
       */
      prompt: z.string().nullish(),
    })
    .nullish(),
  /**
   * Configuration for translating the transcription.
   */
  translation_config: z
    .object({
      /**
       * Target languages for translation.
       */
      target_languages: z.array(
        z.object({
          /**
           * Language code for translation target.
           */
          language: z.enum([
            'en',
            'en-us',
            'en-gb',
            'ar',
            'pt',
            'pt-br',
            'pt-pt',
            'fr',
            'fr-ca',
            'es',
            'es-es',
            'es-la',
            'it',
            'ja',
            'ko',
            'de',
            'ru',
          ]),
        }),
      ),
      /**
       * Model to use for translation.
       */
      model: z.enum(['standard', 'premium']).nullish().default('standard'),
    })
    .nullish(),
  /**
   * Language of the audio content.
   */
  language: z.string().nullish().default('en'),
  /**
   * Whether to perform forced alignment.
   */
  forced_alignment: z.boolean().nullish().default(false),
});

export type RevaiTranscriptionModelOptions = z.infer<
  typeof revaiTranscriptionModelOptionsSchema
>;
