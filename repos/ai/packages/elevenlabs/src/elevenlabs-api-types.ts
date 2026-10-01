export type ElevenLabsTranscriptionAPITypes = {
  /**
   * An ISO-639-1 or ISO-639-3 language_code corresponding to the language of the audio file.
   * Can sometimes improve transcription performance if known beforehand.
   * Defaults to null, in this case the language is predicted automatically.
   */
  language_code?: string;

  /**
   * Whether to tag audio events like (laughter), (footsteps), etc. in the transcription.
   * @default true
   */
  tag_audio_events?: boolean;

  /**
   * The maximum amount of speakers talking in the uploaded file.
   * Can help with predicting who speaks when.
   * The maximum amount of speakers that can be predicted is 32.
   * Defaults to null, in this case the amount of speakers is set to the maximum value the model supports.
   * @min 1
   * @max 32
   */
  num_speakers?: number;

  /**
   * The granularity of the timestamps in the transcription.
   * 'word' provides word-level timestamps and 'character' provides character-level timestamps per word.
   * @default 'word'
   */
  timestamps_granularity?: 'none' | 'word' | 'character';

  /**
   * Whether to annotate which speaker is currently talking in the uploaded file.
   * @default false
   */
  diarize?: boolean;

  /**
   * A list of additional formats to export the transcript to.
   */
  additional_formats?: Array<
    | {
        format: 'docx';
        include_speakers?: boolean;
        include_timestamps?: boolean;
        max_segment_chars?: number;
        max_segment_duration_s?: number;
        segment_on_silence_longer_than_s?: number;
      }
    | {
        format: 'html';
        include_speakers?: boolean;
        include_timestamps?: boolean;
        max_segment_chars?: number;
        max_segment_duration_s?: number;
        segment_on_silence_longer_than_s?: number;
      }
    | {
        format: 'pdf';
        include_speakers?: boolean;
        include_timestamps?: boolean;
        max_segment_chars?: number;
        max_segment_duration_s?: number;
        segment_on_silence_longer_than_s?: number;
      }
    | {
        format: 'segmented_json';
        max_segment_chars?: number;
        max_segment_duration_s?: number;
        segment_on_silence_longer_than_s?: number;
      }
    | {
        format: 'srt';
        include_speakers?: boolean;
        include_timestamps?: boolean;
        max_characters_per_line?: number;
        max_segment_chars?: number;
        max_segment_duration_s?: number;
        segment_on_silence_longer_than_s?: number;
      }
    | {
        format: 'txt';
        include_speakers?: boolean;
        include_timestamps?: boolean;
        max_characters_per_line?: number;
        max_segment_chars?: number;
        max_segment_duration_s?: number;
        segment_on_silence_longer_than_s?: number;
      }
  >;

  /**
   * The format of input audio.
   * For pcm_s16le_16, the input audio must be 16-bit PCM at a 16kHz sample rate,
   * single channel (mono), and little-endian byte order.
   * Latency will be lower than with passing an encoded waveform.
   * @default 'other'
   */
  file_format?: 'pcm_s16le_16' | 'other';
};
