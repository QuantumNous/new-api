import { z } from 'zod/v4';

// https://docs.gladia.io/api-reference/v2/pre-recorded/init
export const gladiaTranscriptionModelOptionsSchema = z.object({
  /**
   * Optional context prompt to guide the transcription.
   */
  contextPrompt: z.string().nullish(),

  /**
   * Custom vocabulary to improve transcription accuracy.
   * Can be a boolean or an array of custom terms.
   */
  customVocabulary: z.union([z.boolean(), z.array(z.any())]).nullish(),

  /**
   * Configuration for custom vocabulary.
   */
  customVocabularyConfig: z
    .object({
      /**
       * Array of vocabulary terms or objects with pronunciation details.
       */
      vocabulary: z.array(
        z.union([
          z.string(),
          z.object({
            /**
             * The vocabulary term.
             */
            value: z.string(),
            /**
             * Intensity of the term in recognition (optional).
             */
            intensity: z.number().nullish(),
            /**
             * Alternative pronunciations for the term (optional).
             */
            pronunciations: z.array(z.string()).nullish(),
            /**
             * Language of the term (optional).
             */
            language: z.string().nullish(),
          }),
        ]),
      ),
      /**
       * Default intensity for all vocabulary terms.
       */
      defaultIntensity: z.number().nullish(),
    })
    .nullish(),

  /**
   * Whether to automatically detect the language of the audio.
   */
  detectLanguage: z.boolean().nullish(),

  /**
   * Whether to enable code switching (multiple languages in the same audio).
   */
  enableCodeSwitching: z.boolean().nullish(),

  /**
   * Configuration for code switching.
   */
  codeSwitchingConfig: z
    .object({
      /**
       * Languages to consider for code switching.
       */
      languages: z.array(z.string()).nullish(),
    })
    .nullish(),

  /**
   * Specific language for transcription.
   */
  language: z.string().nullish(),

  /**
   * Whether to enable callback when transcription is complete.
   */
  callback: z.boolean().nullish(),

  /**
   * Configuration for callback.
   */
  callbackConfig: z
    .object({
      /**
       * URL to send the callback to.
       */
      url: z.string(),
      /**
       * HTTP method for the callback.
       */
      method: z.enum(['POST', 'PUT']).nullish(),
    })
    .nullish(),

  /**
   * Whether to generate subtitles.
   */
  subtitles: z.boolean().nullish(),

  /**
   * Configuration for subtitles generation.
   */
  subtitlesConfig: z
    .object({
      /**
       * Subtitle file formats to generate.
       */
      formats: z.array(z.enum(['srt', 'vtt'])).nullish(),
      /**
       * Minimum duration for subtitle segments.
       */
      minimumDuration: z.number().nullish(),
      /**
       * Maximum duration for subtitle segments.
       */
      maximumDuration: z.number().nullish(),
      /**
       * Maximum characters per row in subtitles.
       */
      maximumCharactersPerRow: z.number().nullish(),
      /**
       * Maximum rows per caption in subtitles.
       */
      maximumRowsPerCaption: z.number().nullish(),
      /**
       * Style of subtitles.
       */
      style: z.enum(['default', 'compliance']).nullish(),
    })
    .nullish(),

  /**
   * Whether to enable speaker diarization (speaker identification).
   */
  diarization: z.boolean().nullish(),

  /**
   * Configuration for diarization.
   */
  diarizationConfig: z
    .object({
      /**
       * Exact number of speakers to identify.
       */
      numberOfSpeakers: z.number().nullish(),
      /**
       * Minimum number of speakers to identify.
       */
      minSpeakers: z.number().nullish(),
      /**
       * Maximum number of speakers to identify.
       */
      maxSpeakers: z.number().nullish(),
      /**
       * Whether to use enhanced diarization.
       */
      enhanced: z.boolean().nullish(),
    })
    .nullish(),

  /**
   * Whether to translate the transcription.
   */
  translation: z.boolean().nullish(),

  /**
   * Configuration for translation.
   */
  translationConfig: z
    .object({
      /**
       * Target languages for translation.
       */
      targetLanguages: z.array(z.string()),
      /**
       * Translation model to use.
       */
      model: z.enum(['base', 'enhanced']).nullish(),
      /**
       * Whether to match original utterances in translation.
       */
      matchOriginalUtterances: z.boolean().nullish(),
    })
    .nullish(),

  /**
   * Whether to generate a summary of the transcription.
   */
  summarization: z.boolean().nullish(),

  /**
   * Configuration for summarization.
   */
  summarizationConfig: z
    .object({
      /**
       * Type of summary to generate.
       */
      type: z.enum(['general', 'bullet_points', 'concise']).nullish(),
    })
    .nullish(),

  /**
   * Whether to enable content moderation.
   */
  moderation: z.boolean().nullish(),

  /**
   * Whether to enable named entity recognition.
   */
  namedEntityRecognition: z.boolean().nullish(),

  /**
   * Whether to enable automatic chapter creation.
   */
  chapterization: z.boolean().nullish(),

  /**
   * Whether to ensure consistent naming of entities.
   */
  nameConsistency: z.boolean().nullish(),

  /**
   * Whether to enable custom spelling.
   */
  customSpelling: z.boolean().nullish(),

  /**
   * Configuration for custom spelling.
   */
  customSpellingConfig: z
    .object({
      /**
       * Dictionary of custom spellings.
       */
      spellingDictionary: z.record(z.string(), z.array(z.string())),
    })
    .nullish(),

  /**
   * Whether to extract structured data from the transcription.
   */
  structuredDataExtraction: z.boolean().nullish(),

  /**
   * Configuration for structured data extraction.
   */
  structuredDataExtractionConfig: z
    .object({
      /**
       * Classes of data to extract.
       */
      classes: z.array(z.string()),
    })
    .nullish(),

  /**
   * Whether to perform sentiment analysis on the transcription.
   */
  sentimentAnalysis: z.boolean().nullish(),

  /**
   * Whether to send audio to a language model for processing.
   */
  audioToLlm: z.boolean().nullish(),

  /**
   * Configuration for audio to language model processing.
   */
  audioToLlmConfig: z
    .object({
      /**
       * Prompts to send to the language model.
       */
      prompts: z.array(z.string()),
    })
    .nullish(),

  /**
   * Custom metadata to include with the transcription.
   */
  customMetadata: z.record(z.string(), z.any()).nullish(),

  /**
   * Whether to include sentence-level segmentation.
   */
  sentences: z.boolean().nullish(),

  /**
   * Whether to enable display mode.
   */
  displayMode: z.boolean().nullish(),

  /**
   * Whether to enhance punctuation in the transcription.
   */
  punctuationEnhanced: z.boolean().nullish(),
});

export type GladiaTranscriptionModelOptions = z.infer<
  typeof gladiaTranscriptionModelOptionsSchema
>;
