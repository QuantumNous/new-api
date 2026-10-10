export type CartesiaSpeechOutputFormat =
  | {
      container: 'mp3';
      sample_rate: CartesiaSpeechSampleRate;
      bit_rate: CartesiaSpeechBitRate;
    }
  | {
      container: 'raw' | 'wav';
      encoding: CartesiaSpeechEncoding;
      sample_rate: CartesiaSpeechSampleRate;
    };

export type CartesiaSpeechEncoding =
  | 'pcm_f32le'
  | 'pcm_s16le'
  | 'pcm_mulaw'
  | 'pcm_alaw';

export type CartesiaSpeechSampleRate =
  | 8000
  | 16000
  | 22050
  | 24000
  | 44100
  | 48000;

export type CartesiaSpeechBitRate = 32000 | 64000 | 96000 | 128000 | 192000;

export type CartesiaSpeechAPITypes = {
  /**
   * The ID of the model to use for the generation.
   */
  model_id: string;

  /**
   * The transcript to generate speech for.
   */
  transcript: string;

  /**
   * The voice specifier. Cartesia uses id mode with a voice id.
   */
  voice: {
    mode: 'id';
    id: string;
  };

  /**
   * The language to generate speech in (ISO 639-1 code).
   */
  language?: string;

  /**
   * The output audio format.
   */
  output_format: CartesiaSpeechOutputFormat;

  /**
   * Controls supported generation attributes.
   */
  generation_config?: {
    speed?: number;
  };
};
