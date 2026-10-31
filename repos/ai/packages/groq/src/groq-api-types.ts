export type GroqChatPrompt = Array<GroqMessage>;

export type GroqMessage =
  | GroqSystemMessage
  | GroqUserMessage
  | GroqAssistantMessage
  | GroqToolMessage;

export interface GroqSystemMessage {
  role: 'system';
  content: string;
}

export interface GroqUserMessage {
  role: 'user';
  content: string | Array<GroqContentPart>;
}

export type GroqContentPart = GroqContentPartText | GroqContentPartImage;

export interface GroqContentPartImage {
  type: 'image_url';
  image_url: { url: string };
}

export interface GroqContentPartText {
  type: 'text';
  text: string;
}

export interface GroqAssistantMessage {
  role: 'assistant';
  content?: string | null;
  reasoning?: string;
  tool_calls?: Array<GroqMessageToolCall>;
}

export interface GroqMessageToolCall {
  type: 'function';
  id: string;
  function: {
    arguments: string;
    name: string;
  };
}

export interface GroqToolMessage {
  role: 'tool';
  content: string;
  tool_call_id: string;
}

export interface GroqTranscriptionAPITypes {
  /**
   * The audio file object for direct upload to translate/transcribe.
   * Required unless using url instead.
   */
  file?: string;

  /**
   * The audio URL to translate/transcribe (supports Base64URL).
   * Required unless using file instead.
   */
  url?: string;

  /**
   * The language of the input audio. Supplying the input language in ISO-639-1 (i.e. en, tr`) format will improve accuracy and latency.
   * The translations endpoint only supports 'en' as a parameter option.
   */
  language?: string;

  /**
   * ID of the model to use.
   */
  model: string;

  /**
   * Prompt to guide the model's style or specify how to spell unfamiliar words. (limited to 224 tokens)
   */
  prompt?: string;

  /**
   * Define the output response format.
   * Set to verbose_json to receive timestamps for audio segments.
   * Set to text to return a text response.
   */
  response_format?: string;

  /**
   * The temperature between 0 and 1. For translations and transcriptions, we recommend the default value of 0.
   */
  temperature?: number;

  /**
   * The timestamp granularities to populate for this transcription. response_format must be set verbose_json to use timestamp granularities.
   * Either or both of word and segment are supported.
   * segment returns full metadata and word returns only word, start, and end timestamps. To get both word-level timestamps and full segment metadata, include both values in the array.
   */
  timestamp_granularities?: Array<string>;
}
