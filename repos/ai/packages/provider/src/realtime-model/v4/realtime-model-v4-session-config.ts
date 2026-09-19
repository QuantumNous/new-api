import type { RealtimeModelV4ToolDefinition } from './realtime-model-v4-tool-definition';

/**
 * Provider-neutral configuration for a realtime session.
 * Each provider maps this to their specific session.update payload.
 */
export type RealtimeModelV4SessionConfig = {
  /**
   * System instructions for the model.
   */
  instructions?: string;

  /**
   * Voice to use for audio output.
   */
  voice?: string;

  /**
   * Which output modalities the model should produce.
   */
  outputModalities?: Array<'text' | 'audio'>;

  /**
   * Audio format configuration for input audio.
   */
  inputAudioFormat?: {
    /**
     * Audio format type (e.g. "audio/pcm", "audio/pcmu", "audio/pcma").
     */
    type: string;

    /**
     * Sample rate in Hz. Only applicable for PCM format.
     */
    rate?: number;
  };

  /**
   * Input audio transcription configuration.
   *
   * When enabled, providers that support input transcription emit normalized
   * `input-transcription-completed` events that can be rendered as user
   * messages.
   */
  inputAudioTranscription?: {
    /**
     * Provider-specific transcription model.
     */
    model?: string;

    /**
     * Optional language hint for the input audio.
     */
    language?: string;

    /**
     * Optional prompt to guide transcription.
     */
    prompt?: string;
  };

  /**
   * Output audio transcription configuration.
   *
   * When enabled, providers that support output transcription emit normalized
   * `audio-transcript-delta` / `audio-transcript-done` events for the model's
   * spoken response. Some providers transcribe output by default; setting this
   * makes the behavior explicit rather than relying on that default.
   */
  outputAudioTranscription?: {
    /**
     * Provider-specific transcription model.
     */
    model?: string;

    /**
     * Optional language hint for the output audio.
     */
    language?: string;

    /**
     * Optional prompt to guide transcription.
     */
    prompt?: string;
  };

  /**
   * Audio format configuration for output audio.
   */
  outputAudioFormat?: {
    /**
     * Audio format type (e.g. "audio/pcm", "audio/pcmu", "audio/pcma").
     */
    type: string;

    /**
     * Sample rate in Hz. Only applicable for PCM format.
     */
    rate?: number;
  };

  /**
   * Voice activity detection configuration.
   * Set to null or type 'disabled' to turn off VAD (push-to-talk mode).
   */
  turnDetection?: {
    /**
     * VAD mode. 'server-vad' for automatic detection,
     * 'semantic-vad' for OpenAI's semantic detection,
     * 'disabled' to turn off VAD.
     */
    type: 'server-vad' | 'semantic-vad' | 'disabled';

    /**
     * VAD activation threshold (0.0-1.0).
     * Higher values require louder audio to trigger.
     */
    threshold?: number;

    /**
     * How long the user must be silent (in ms) before
     * the server ends the turn.
     */
    silenceDurationMs?: number;

    /**
     * Amount of audio (in ms) to include before the
     * detected start of speech.
     */
    prefixPaddingMs?: number;
  } | null;

  /**
   * Tool definitions available to the model in this session.
   */
  tools?: RealtimeModelV4ToolDefinition[];

  /**
   * Provider-specific options that are passed through to the provider.
   */
  providerOptions?: Record<string, unknown>;
};
