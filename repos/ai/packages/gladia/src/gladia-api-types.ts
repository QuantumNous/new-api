export type GladiaTranscriptionInitiateAPITypes = {
  /** URL to a Gladia file or to an external audio or video file */
  audio_url: string;
  /** [Alpha] Context to feed the transcription model with for possible better accuracy */
  context_prompt?: string;
  /** [Beta] Can be either boolean to enable custom_vocabulary or an array with specific vocabulary */
  custom_vocabulary?: boolean | any[];
  /** [Beta] Custom vocabulary configuration */
  custom_vocabulary_config?: {
    /** Vocabulary array with string or object containing value, intensity, pronunciations, and language */
    vocabulary: Array<
      | string
      | {
          /** Vocabulary value */
          value: string;
          /** Intensity of the vocabulary */
          intensity?: number;
          /** Pronunciation variations */
          pronunciations?: string[];
          /** Language of the vocabulary */
          language?: string;
        }
    >;
    /** Default intensity for vocabulary */
    default_intensity?: number;
  };
  /** Detect the language from the given audio */
  detect_language?: boolean;
  /** Detect multiple languages in the given audio */
  enable_code_switching?: boolean;
  /** Configuration for code-switching */
  code_switching_config?: {
    /** Specify the languages you want to use when detecting multiple languages */
    languages?: string[];
  };
  /** The original language in iso639-1 format */
  language?: string;
  /** Enable callback for this transcription */
  callback?: boolean;
  /** Configuration for callback */
  callback_config?: {
    /** The URL to be called with the result of the transcription */
    url: string;
    /** The HTTP method to be used */
    method?: 'POST' | 'PUT';
  };
  /** Enable subtitles generation for this transcription */
  subtitles?: boolean;
  /** Configuration for subtitles */
  subtitles_config?: {
    /** Subtitles formats */
    formats?: ('srt' | 'vtt')[];
    /** Minimum duration of a subtitle in seconds */
    minimum_duration?: number;
    /** Maximum duration of a subtitle in seconds */
    maximum_duration?: number;
    /** Maximum number of characters per row */
    maximum_characters_per_row?: number;
    /** Maximum number of rows per caption */
    maximum_rows_per_caption?: number;
    /** Style of the subtitles */
    style?: 'default' | 'compliance';
  };
  /** Enable speaker recognition (diarization) for this audio */
  diarization?: boolean;
  /** Configuration for diarization */
  diarization_config?: {
    /** Exact number of speakers in the audio */
    number_of_speakers?: number;
    /** Minimum number of speakers in the audio */
    min_speakers?: number;
    /** Maximum number of speakers in the audio */
    max_speakers?: number;
    /** [Alpha] Use enhanced diarization for this audio */
    enhanced?: boolean;
  };
  /** [Beta] Enable translation for this audio */
  translation?: boolean;
  /** Configuration for translation */
  translation_config?: {
    /** The target language in iso639-1 format */
    target_languages: string[];
    /** Model for translation */
    model?: 'base' | 'enhanced';
    /** Align translated utterances with the original ones */
    match_original_utterances?: boolean;
  };
  /** [Beta] Enable summarization for this audio */
  summarization?: boolean;
  /** Configuration for summarization */
  summarization_config?: {
    /** The type of summarization to apply */
    type?: 'general' | 'bullet_points' | 'concise';
  };
  /** [Alpha] Enable moderation for this audio */
  moderation?: boolean;
  /** [Alpha] Enable named entity recognition for this audio */
  named_entity_recognition?: boolean;
  /** [Alpha] Enable chapterization for this audio */
  chapterization?: boolean;
  /** [Alpha] Enable names consistency for this audio */
  name_consistency?: boolean;
  /** [Alpha] Enable custom spelling for this audio */
  custom_spelling?: boolean;
  /** Configuration for custom spelling */
  custom_spelling_config?: {
    /** The list of spelling applied on the audio transcription */
    spelling_dictionary: Record<string, string[]>;
  };
  /** [Alpha] Enable structured data extraction for this audio */
  structured_data_extraction?: boolean;
  /** Configuration for structured data extraction */
  structured_data_extraction_config?: {
    /** The list of classes to extract from the audio transcription */
    classes: string[];
  };
  /** [Alpha] Enable sentiment analysis for this audio */
  sentiment_analysis?: boolean;
  /** [Alpha] Enable audio to llm processing for this audio */
  audio_to_llm?: boolean;
  /** Configuration for audio to llm */
  audio_to_llm_config?: {
    /** The list of prompts applied on the audio transcription */
    prompts: string[];
  };
  /** Custom metadata you can attach to this transcription */
  custom_metadata?: Record<string, any>;
  /** Enable sentences for this audio */
  sentences?: boolean;
  /** [Alpha] Allows to change the output display_mode for this audio */
  display_mode?: boolean;
  /** [Alpha] Use enhanced punctuation for this audio */
  punctuation_enhanced?: boolean;
};
