export type ElevenLabsSpeechAPITypes = {
  text: string;
  model_id?: string;
  language_code?: string;
  voice_settings?: {
    stability?: number;
    similarity_boost?: number;
    style?: number;
    use_speaker_boost?: boolean;
    speed?: number;
  };
  pronunciation_dictionary_locators?: Array<{
    pronunciation_dictionary_id: string;
    version_id?: string;
  }>;
  seed?: number;
  previous_text?: string;
  next_text?: string;
  previous_request_ids?: string[];
  next_request_ids?: string[];
  apply_text_normalization?: 'auto' | 'on' | 'off';
  apply_language_text_normalization?: boolean;
};
