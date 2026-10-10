export type DeepgramTranscriptionAPITypes = {
  // Base parameters
  language?: string;
  detect_language?: boolean;
  model?: string;

  // Formatting options
  smart_format?: boolean;
  punctuate?: boolean;
  paragraphs?: boolean;

  // Summarization and analysis
  summarize?: 'v2' | false;
  topics?: boolean;
  intents?: boolean;
  sentiment?: boolean;

  // Entity detection
  detect_entities?: boolean;

  // Redaction options
  redact?: string | string[];
  replace?: string;

  // Search and keywords
  search?: string;
  keyterm?: string;

  // Speaker-related features
  diarize?: boolean;
  utterances?: boolean;
  utt_split?: number;

  // Miscellaneous
  filler_words?: boolean;
};
