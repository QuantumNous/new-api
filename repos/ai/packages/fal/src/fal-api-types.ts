export type FalTranscriptionAPITypes = {
  /**
   * URL of the audio file to transcribe. Supported formats: mp3, mp4, mpeg, mpga, m4a, wav or webm.
   */
  audio_url: string;

  /**
   * Task to perform on the audio file. Either transcribe or translate. Default value: "transcribe"
   */
  task?: 'transcribe' | 'translate';

  /**
   * Language of the audio file. If set to null, the language will be automatically detected. Defaults to null.
   *
   * If translate is selected as the task, the audio will be translated to English, regardless of the language selected.
   */
  language?:
    | 'af'
    | 'am'
    | 'ar'
    | 'as'
    | 'az'
    | 'ba'
    | 'be'
    | 'bg'
    | 'bn'
    | 'bo'
    | 'br'
    | 'bs'
    | 'ca'
    | 'cs'
    | 'cy'
    | 'da'
    | 'de'
    | 'el'
    | 'en'
    | 'es'
    | 'et'
    | 'eu'
    | 'fa'
    | 'fi'
    | 'fo'
    | 'fr'
    | 'gl'
    | 'gu'
    | 'ha'
    | 'haw'
    | 'he'
    | 'hi'
    | 'hr'
    | 'ht'
    | 'hu'
    | 'hy'
    | 'id'
    | 'is'
    | 'it'
    | 'ja'
    | 'jw'
    | 'ka'
    | 'kk'
    | 'km'
    | 'kn'
    | 'ko'
    | 'la'
    | 'lb'
    | 'ln'
    | 'lo'
    | 'lt'
    | 'lv'
    | 'mg'
    | 'mi'
    | 'mk'
    | 'ml'
    | 'mn'
    | 'mr'
    | 'ms'
    | 'mt'
    | 'my'
    | 'ne'
    | 'nl'
    | 'nn'
    | 'no'
    | 'oc'
    | 'pa'
    | 'pl'
    | 'ps'
    | 'pt'
    | 'ro'
    | 'ru'
    | 'sa'
    | 'sd'
    | 'si'
    | 'sk'
    | 'sl'
    | 'sn'
    | 'so'
    | 'sq'
    | 'sr'
    | 'su'
    | 'sv'
    | 'sw'
    | 'ta'
    | 'te'
    | 'tg'
    | 'th'
    | 'tk'
    | 'tl'
    | 'tr'
    | 'tt'
    | 'uk'
    | 'ur'
    | 'uz'
    | 'vi'
    | 'yi'
    | 'yo'
    | 'yue'
    | 'zh'
    | null;

  /**
   * Whether to diarize the audio file. Defaults to true.
   */
  diarize?: boolean;

  /**
   * Level of the chunks to return. Either segment or word. Default value: "segment"
   */
  chunk_level?: 'segment' | 'word';

  /**
   * Version of the model to use. All of the models are the Whisper large variant. Default value: "3"
   */
  version?: '3';

  /**
   * Default value: 64
   */
  batch_size?: number;

  /**
   * Prompt to use for generation. Defaults to an empty string. Default value: ""
   */
  prompt?: string;

  /**
   * Number of speakers in the audio file. Defaults to null. If not provided, the number of speakers will be automatically detected.
   */
  num_speakers?: number | null;
};

export const FAL_LANGUAGE_BOOSTS = [
  'Chinese',
  'Chinese,Yue',
  'English',
  'Arabic',
  'Russian',
  'Spanish',
  'French',
  'Portuguese',
  'German',
  'Turkish',
  'Dutch',
  'Ukrainian',
  'Vietnamese',
  'Indonesian',
  'Japanese',
  'Italian',
  'Korean',
  'Thai',
  'Polish',
  'Romanian',
  'Greek',
  'Czech',
  'Finnish',
  'Hindi',
  'auto',
] as const;
export type FalLanguageBoost = (typeof FAL_LANGUAGE_BOOSTS)[number];

export const FAL_EMOTIONS = [
  'happy',
  'sad',
  'angry',
  'fearful',
  'disgusted',
  'surprised',
  'neutral',
] as const;
export type FalEmotion = (typeof FAL_EMOTIONS)[number];
