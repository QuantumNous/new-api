import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { describe, expect, it, vi } from 'vitest';
import { createElevenLabs } from './elevenlabs-provider';

vi.mock('./version', () => ({
  VERSION: '0.0.0-test',
}));

const provider = createElevenLabs({ apiKey: 'test-api-key' });
const model = provider.speech('eleven_multilingual_v2');

const server = createTestServer({
  'https://api.elevenlabs.io/v1/text-to-speech/*': {},
});

describe('ElevenLabsSpeechModel', () => {
  function prepareAudioResponse({
    headers,
    format = 'mp3',
  }: {
    headers?: Record<string, string>;
    format?: string;
  } = {}) {
    const audioBuffer = new Uint8Array(100); // Mock audio data
    server.urls['https://api.elevenlabs.io/v1/text-to-speech/*'].response = {
      type: 'binary',
      headers: {
        'content-type': `audio/${format}`,
        ...headers,
      },
      body: Buffer.from(audioBuffer),
    };
    return audioBuffer;
  }

  describe('doGenerate', () => {
    it('should generate speech with required parameters', async () => {
      prepareAudioResponse();

      await model.doGenerate({
        text: 'Hello, world!',
        voice: 'test-voice-id',
      });

      expect(await server.calls[0].requestBodyJson).toMatchObject({
        text: 'Hello, world!',
        model_id: 'eleven_multilingual_v2',
      });

      // Check output_format is in query params
      expect(server.calls[0].requestUrl).toContain(
        'output_format=mp3_44100_128',
      );
    });

    it('should handle custom output format', async () => {
      prepareAudioResponse();

      await model.doGenerate({
        text: 'Hello, world!',
        voice: 'test-voice-id',
        outputFormat: 'pcm_44100',
      });

      expect(await server.calls[0].requestBodyJson).toMatchObject({
        text: 'Hello, world!',
        model_id: 'eleven_multilingual_v2',
      });

      // Check output_format is in query params
      expect(server.calls[0].requestUrl).toContain('output_format=pcm_44100');
    });

    it('should handle language parameter', async () => {
      prepareAudioResponse();

      await model.doGenerate({
        text: 'Hola, mundo!',
        voice: 'test-voice-id',
        language: 'es',
      });

      expect(await server.calls[0].requestBodyJson).toMatchObject({
        text: 'Hola, mundo!',
        model_id: 'eleven_multilingual_v2',
        language_code: 'es',
      });

      // Check output_format is in query params
      expect(server.calls[0].requestUrl).toContain(
        'output_format=mp3_44100_128',
      );
    });

    it('should handle speed parameter in voice settings', async () => {
      prepareAudioResponse();

      await model.doGenerate({
        text: 'Hello, world!',
        voice: 'test-voice-id',
        speed: 1.5,
      });

      expect(await server.calls[0].requestBodyJson).toMatchObject({
        text: 'Hello, world!',
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          speed: 1.5,
        },
      });
    });

    it('should warn about unsupported instructions parameter', async () => {
      prepareAudioResponse();

      const result = await model.doGenerate({
        text: 'Hello, world!',
        voice: 'test-voice-id',
        instructions: 'Speak slowly',
      });

      expect(result.warnings).toMatchInlineSnapshot(`
        [
          {
            "details": "ElevenLabs speech models do not support instructions. Instructions parameter was ignored.",
            "feature": "instructions",
            "type": "unsupported",
          },
        ]
      `);
    });

    it('should pass provider-specific options', async () => {
      prepareAudioResponse();

      await model.doGenerate({
        text: 'Hello, world!',
        voice: 'test-voice-id',
        providerOptions: {
          elevenlabs: {
            voiceSettings: {
              stability: 0.5,
              similarityBoost: 0.75,
            },
            seed: 123,
          },
        },
      });

      expect(await server.calls[0].requestBodyJson).toMatchObject({
        text: 'Hello, world!',
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
        seed: 123,
      });

      // Check output_format is in query params
      expect(server.calls[0].requestUrl).toContain(
        'output_format=mp3_44100_128',
      );
    });

    it('should include user-agent header', async () => {
      prepareAudioResponse();

      await model.doGenerate({
        text: 'Hello, world!',
        voice: 'test-voice-id',
      });

      expect(server.calls[0].requestUserAgent).toContain(
        `ai-sdk/elevenlabs/0.0.0-test`,
      );
    });
  });
});
