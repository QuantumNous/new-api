import { describe, expect, it } from 'vitest';
import { buildOpenAISessionConfig } from './openai-realtime-event-mapper';

describe('buildOpenAISessionConfig', () => {
  it('enables input audio transcription with a default model', () => {
    const result = buildOpenAISessionConfig(
      { inputAudioTranscription: {} },
      'gpt-realtime',
    );

    expect(result.audio).toEqual({
      input: {
        transcription: {
          model: 'gpt-realtime-whisper',
        },
      },
    });
  });

  it('maps input audio transcription options', () => {
    const result = buildOpenAISessionConfig(
      {
        inputAudioTranscription: {
          model: 'gpt-4o-mini-transcribe',
          language: 'en',
          prompt: 'Transcribe short voice chat messages.',
        },
      },
      'gpt-realtime',
    );

    expect(result.audio).toEqual({
      input: {
        transcription: {
          model: 'gpt-4o-mini-transcribe',
          language: 'en',
          prompt: 'Transcribe short voice chat messages.',
        },
      },
    });
  });
});
