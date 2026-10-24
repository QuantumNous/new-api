export type RevaiTranscriptionAPITypes = {
  /**
   * Optional metadata that was provided during job submission.
   */
  metadata?: string | null;

  /**
   * Optional configuration for a callback url to invoke when processing is complete,
   * in addition to auth headers if they are needed to invoke the callback url.
   * Cannot be set if callback_url is set. This option will not be visible in the submission response.
   */
  notification_config?: {
    /**
     * Optional callback url to invoke when processing is complete
     */
    url: string;
    /**
     * Optional authorization headers, if they are needed to invoke the callback.
     * There are a few constraints: 1) the "Authorization" header is the only header that can be passed in,
     * and 2) the header value must be of the form <scheme> <token>.
     * For example: {"Authorization": "Bearer $BEARER_TOKEN"}
     */
    auth_headers?: {
      /**
       * Authorization header
       */
      Authorization: string;
    } | null;
  } | null;

  /**
   * Amount of time after job completion when job is auto-deleted. Present only when preference set in job request.
   */
  delete_after_seconds?: number | null;

  /**
   * Select which service you would like to transcribe this file with.
   * - machine: the default and routes to our standard (Reverb) model.
   * - low_cost: low-cost transcription which uses quantized ASR model (Reverb Turbo) with low-cost environment.
   * - fusion: higher quality ASR that combines multiple models to achieve the best results. Typically has better support for rare words.
   * @default "machine"
   */
  transcriber?: 'machine' | 'low_cost' | 'fusion' | null;

  /**
   * Configures the transcriber to transcribe every syllable. This will include all false starts and disfluencies in the transcript.
   *
   * The behavior depends on the transcriber option:
   * - machine: the default is true. To turn it off false should be explicitly provided
   * - human: the default is false To turn it on true should be explicitly provided
   */
  verbatim?: boolean;

  /**
   * [HIPAA Unsupported] Only available for human transcriber option
   * When this field is set to true your job is given higher priority and will be worked on sooner by our human transcribers.
   * @default false
   */
  rush?: boolean | null;

  /**
   * [HIPAA Unsupported] Only available for human transcriber option
   * When this field is set to true the behavior will mock a normal human transcription job except no transcription will happen.
   * The primary use case is to test integrations without being charged for human transcription.
   * @default false
   */
  test_mode?: boolean | null;

  /**
   * [HIPAA Unsupported] Only available for human transcriber option.
   * Use this option to specify which sections of the transcript need to be transcribed.
   * Segments must be at least 1 minute in length and cannot overlap.
   */
  segments_to_transcribe?: Array<{
    /**
     * The timestamp of the beginning of the segment relative to the beginning of the audio in seconds (centisecond precision)
     */
    start: number;
    /**
     * The timestamp of the end of the segment relative to the beginning of the audio in seconds (centisecond precision)
     */
    end: number;
  }> | null;

  /**
   * [HIPAA Unsupported] Only available for human transcriber option.
   * Use this option to specify up to 100 names of speakers in the transcript.
   * Names may only be up to 50 characters long.
   */
  speaker_names?: Array<{
    /**
     * The name of the speaker to be used when labeling monologues. Max of 50 characters.
     */
    display_name: string;
  }> | null;

  /**
   * Specify if speaker diarization will be skipped by the speech engine
   * @default false
   */
  skip_diarization?: boolean | null;

  /**
   * Only available for English and Spanish languages.
   * User-supplied preference on whether to skip post-processing operations such as inverse text normalization (ITN), casing and punctuation.
   * @default false
   */
  skip_postprocessing?: boolean | null;

  /**
   * Specify if "punct" type elements will be skipped by the speech engine.
   * For JSON outputs, this includes removing spaces. For text outputs, words will still be delimited by a space
   * @default false
   */
  skip_punctuation?: boolean | null;

  /**
   * Currently we only define disfluencies as 'ums' and 'uhs'.
   * When set to true, disfluencies will not appear in the transcript.
   * This option also removes atmospherics if the remove_atmospherics is not set.
   * This option is not available for human transcription jobs.
   * @default false
   */
  remove_disfluencies?: boolean | null;

  /**
   * We define many atmospherics such <laugh>, <affirmative> etc.
   * When set to true, atmospherics will not appear in the transcript.
   * This option is not available for human transcription jobs.
   * @default false
   */
  remove_atmospherics?: boolean | null;

  /**
   * Enabling this option will filter for approx. 600 profanities, which cover most use cases.
   * If a transcribed word matches a word on this list, then all the characters of that word will be replaced by asterisks
   * except for the first and last character.
   * @default false
   */
  filter_profanity?: boolean | null;

  /**
   * Only available for English, Spanish and French languages.
   * Use to specify the total number of unique speaker channels in the audio.
   *
   * Given the number of audio channels provided, each channel will be transcribed separately and the channel id assigned to the speaker label.
   * The final output will be a combination of all individual channel outputs.
   * Overlapping monologues will have ordering broken by the order in which the first spoken element of each monologue occurs.
   * If speaker_channels_count is greater than the actual channels in the audio, the job will fail with invalid_media.
   * This option is not available for human transcription jobs.
   */
  speaker_channels_count?: number | null;

  /**
   * Only available for English, Spanish and French languages.
   * Use to specify the total number of unique speakers in the audio.
   *
   * Given the count of speakers provided, it will be used to improve the diarization accuracy.
   * This option is not available for human transcription jobs.
   * @default null
   */
  speakers_count?: number | null;

  /**
   * Use to specify diarization type. This option is not available for human transcription jobs and low-cost environment.
   * @default "standard"
   */
  diarization_type?: 'standard' | 'premium' | null;

  /**
   * This feature is in beta. You can supply the id of a pre-completed custom vocabulary that you submitted through the Custom Vocabularies API
   * instead of uploading the list of phrases using the custom_vocabularies parameter.
   * Using custom_vocabulary_id or custom_vocabularies with the same list of phrases yields the same transcription result,
   * but custom_vocabulary_id enables your submission to finish processing faster by 6 seconds on average.
   *
   * You cannot use both custom_vocabulary_id and custom_vocabularies at the same time, and doing so will result in a 400 response.
   * If the supplied id represents an incomplete, deleted, or non-existent custom vocabulary then you will receive a 404 response.
   */
  custom_vocabulary_id?: string | null;

  /**
   * Specify a collection of custom vocabulary to be used for this job.
   * Custom vocabulary informs and biases the speech recognition to find those phrases (at the cost of slightly slower transcription).
   */
  custom_vocabularies?: Array<object>;

  /**
   * If true, only exact phrases will be used as custom vocabulary, i.e. phrases will not be split into individual words for processing.
   * By default is enabled.
   */
  strict_custom_vocabulary?: boolean;

  /**
   * Use to specify summarization options. This option is not available for human transcription jobs.
   */
  summarization_config?: {
    /**
     * Model type for summarization.
     * @default "standard"
     */
    model?: 'standard' | 'premium' | null;
    /**
     * Summarization formatting type. Use Paragraph for a text summary or Bullets for a list of topics.
     * prompt and type parameters are mutuially exclusive.
     * @default "paragraph"
     */
    type?: 'paragraph' | 'bullets' | null;
    /**
     * Custom prompt. Provides the most flexible way to create summaries, but may lead to unpredictable results.
     * Summary is produced in Markdown format.
     * prompt and type parameters are mutuially exclusive.
     */
    prompt?: string | null;
  } | null;

  /**
   * Use to specify translation options. This option is not available for human transcription jobs.
   */
  translation_config?: {
    /**
     * Target languages for translation.
     */
    target_languages: Array<{
      /**
       * Target language for translation.
       */
      language:
        | 'en'
        | 'en-us'
        | 'en-gb'
        | 'ar'
        | 'pt'
        | 'pt-br'
        | 'pt-pt'
        | 'fr'
        | 'fr-ca'
        | 'es'
        | 'es-es'
        | 'es-la'
        | 'it'
        | 'ja'
        | 'ko'
        | 'de'
        | 'ru';
    }>;
    /**
     * Model type for translation.
     * @default "standard"
     */
    model?: 'standard' | 'premium' | null;
  } | null;

  /**
   * Language is provided as a ISO 639-1 language code, with exceptions.
   * Only 1 language can be selected per audio, i.e. no multiple languages in one transcription job.
   * @default "en"
   */
  language?: string | null;

  /**
   * Provides improved accuracy for per-word timestamps for a transcript.
   *
   * The following languages are currently supported:
   * - English (en, en-us, en-gb)
   * - French (fr)
   * - Italian (it)
   * - German (de)
   * - Spanish (es)
   *
   * This option is not available in low-cost environment
   * @default false
   */
  forced_alignment?: boolean | null;
};
