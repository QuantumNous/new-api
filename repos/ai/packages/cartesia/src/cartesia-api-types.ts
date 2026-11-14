export type CartesiaTranscriptionAPITypes = {
  /**
   * The ID of the model to use for transcription.
   */
  model: string;

  /**
   * The language of the audio (ISO 639-1 code). Defaults to English.
   */
  language?: string;

  /**
   * The timestamp granularities to populate for this transcription.
   * Currently only `word` is supported.
   */
  'timestamp_granularities[]'?: 'word';
};
