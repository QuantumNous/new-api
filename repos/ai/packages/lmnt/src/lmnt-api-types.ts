export type LMNTSpeechAPITypes = {
  /** The voice id of the voice to use; voice ids can be retrieved by calls to List voices or Voice info. */
  voice: string;
  /** The text to synthesize; max 5000 characters per request (including spaces) */
  text: string;
  /** The model to use for synthesis. One of aurora (default) or blizzard. */
  model?: 'aurora' | 'blizzard';
  /** The desired language. Two letter ISO 639-1 code. Does not work with professional clones. Not all languages work with all models. Defaults to auto language detection. */
  language?:
    | 'auto'
    | 'en'
    | 'es'
    | 'pt'
    | 'fr'
    | 'de'
    | 'zh'
    | 'ko'
    | 'hi'
    | 'ja'
    | 'ru'
    | 'it'
    | 'tr';
  /** The file format of the audio output */
  format?: 'aac' | 'mp3' | 'mulaw' | 'raw' | 'wav';
  /** The desired output sample rate in Hz */
  sample_rate?: 8000 | 16000 | 24000;
  /** The talking speed of the generated speech, a floating point value between 0.25 (slow) and 2.0 (fast). */
  speed?: number;
  /** Seed used to specify a different take; defaults to random */
  seed?: number;
  /** Set this to true to generate conversational-style speech rather than reading-style speech. Does not work with the blizzard model. */
  conversational?: boolean;
  /** Produce speech of this length in seconds; maximum 300.0 (5 minutes). Does not work with the blizzard model. */
  length?: number;
  /** Controls the stability of the generated speech. A lower value (like 0.3) produces more consistent, reliable speech. A higher value (like 0.9) gives more flexibility in how words are spoken, but might occasionally produce unusual intonations or speech patterns. */
  top_p?: number;
  /** Influences how expressive and emotionally varied the speech becomes. Lower values (like 0.3) create more neutral, consistent speaking styles. Higher values (like 1.0) allow for more dynamic emotional range and speaking styles. */
  temperature?: number;
};
