import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { describe, expect, it, vi } from 'vitest';
import { createCartesia } from './cartesia-provider';
import { CartesiaSpeechModel } from './cartesia-speech-model';

vi.mock('./version', () => ({
  VERSION: '0.0.0-test',
}));

const provider = createCartesia({ apiKey: 'test-api-key' });
const model = provider.speech('sonic-3.5');

const server = createTestServer({
  'https://api.cartesia.ai/tts/bytes': {},
});

describe('CartesiaSpeechModel', () => {
  function prepareAudioResponse({
    headers,
    format = 'mp3',
  }: {
    headers?: Record<string, string>;
    format?: string;
  } = {}) {
    const audioBuffer = new Uint8Array(100); // Mock audio data
    server.urls['https://api.cartesia.ai/tts/bytes'].response = {
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

      expect(await server.calls[0].requestBodyJson).toStrictEqual({
        model_id: 'sonic-3.5',
        transcript: 'Hello, world!',
        voice: {
          mode: 'id',
          id: 'test-voice-id',
        },
        output_format: {
          container: 'mp3',
          sample_rate: 44100,
          bit_rate: 128000,
        },
      });
    });

    it('should throw when no voice is provided', async () => {
      prepareAudioResponse();

      await expect(
        model.doGenerate({
          text: 'Hello, world!',
        }),
      ).rejects.toThrow('Cartesia speech models require a `voice` to be set.');
    });

    it('should map wav output format', async () => {
      prepareAudioResponse();

      await model.doGenerate({
        text: 'Hello, world!',
        voice: 'test-voice-id',
        outputFormat: 'wav',
      });

      expect(await server.calls[0].requestBodyJson).toMatchObject({
        output_format: {
          container: 'wav',
          encoding: 'pcm_s16le',
          sample_rate: 44100,
        },
      });
    });

    it('should map pcm output format with sample rate suffix', async () => {
      prepareAudioResponse();

      await model.doGenerate({
        text: 'Hello, world!',
        voice: 'test-voice-id',
        outputFormat: 'pcm_24000',
      });

      expect(await server.calls[0].requestBodyJson).toMatchObject({
        output_format: {
          container: 'raw',
          encoding: 'pcm_f32le',
          sample_rate: 24000,
        },
      });
    });

    it('should handle language parameter', async () => {
      prepareAudioResponse();

      await model.doGenerate({
        text: 'Hola, mundo!',
        voice: 'test-voice-id',
        language: 'es',
      });

      expect(await server.calls[0].requestBodyJson).toMatchObject({
        transcript: 'Hola, mundo!',
        language: 'es',
      });
    });

    it('should handle speed parameter', async () => {
      prepareAudioResponse();

      await model.doGenerate({
        text: 'Hello, world!',
        voice: 'test-voice-id',
        speed: 1.5,
      });

      expect(await server.calls[0].requestBodyJson).toMatchObject({
        generation_config: {
          speed: 1.5,
        },
      });
    });

    it('should warn and ignore an out-of-range generic speed', async () => {
      prepareAudioResponse();

      const result = await model.doGenerate({
        text: 'Hello, world!',
        voice: 'test-voice-id',
        speed: 2,
      });

      expect(await server.calls[0].requestBodyJson).not.toHaveProperty(
        'generation_config',
      );
      expect(result.warnings).toMatchInlineSnapshot(`
        [
          {
            "details": "Cartesia speed must be between 0.6 and 1.5. The speed option was ignored.",
            "feature": "speed",
            "type": "unsupported",
          },
        ]
      `);
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
            "details": "Cartesia speech models do not support instructions. Instructions parameter was ignored.",
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
          cartesia: {
            container: 'raw',
            encoding: 'pcm_s16le',
            sampleRate: 16000,
            speed: 0.8,
          },
        },
      });

      expect(await server.calls[0].requestBodyJson).toMatchObject({
        output_format: {
          container: 'raw',
          encoding: 'pcm_s16le',
          sample_rate: 16000,
        },
        generation_config: {
          speed: 0.8,
        },
      });
    });

    it('should ignore encoding for mp3 output', async () => {
      prepareAudioResponse();

      const result = await model.doGenerate({
        text: 'Hello, world!',
        voice: 'test-voice-id',
        providerOptions: {
          cartesia: {
            encoding: 'pcm_s16le',
          },
        },
      });

      expect(
        (await server.calls[0].requestBodyJson).output_format,
      ).toStrictEqual({
        container: 'mp3',
        sample_rate: 44100,
        bit_rate: 128000,
      });
      expect(result.warnings).toMatchInlineSnapshot(`
        [
          {
            "details": "Cartesia MP3 output does not accept an encoding. The encoding option was ignored.",
            "feature": "providerOptions.cartesia.encoding",
            "type": "unsupported",
          },
        ]
      `);
    });

    it('should warn about an unsupported sample rate suffix', async () => {
      prepareAudioResponse();

      const result = await model.doGenerate({
        text: 'Hello, world!',
        voice: 'test-voice-id',
        outputFormat: 'wav_12345',
      });

      expect(
        (await server.calls[0].requestBodyJson).output_format,
      ).toMatchObject({
        container: 'wav',
        sample_rate: 44100,
      });
      expect(result.warnings).toMatchInlineSnapshot(`
        [
          {
            "details": "Unsupported Cartesia sample rate in output format \"wav_12345\". Using 44100 Hz instead.",
            "feature": "outputFormat",
            "type": "unsupported",
          },
        ]
      `);
    });

    it('should pass headers', async () => {
      prepareAudioResponse();

      const provider = createCartesia({
        apiKey: 'test-api-key',
        headers: {
          'Custom-Provider-Header': 'provider-header-value',
        },
      });

      await provider.speech('sonic-3.5').doGenerate({
        text: 'Hello, world!',
        voice: 'test-voice-id',
        headers: {
          'Custom-Request-Header': 'request-header-value',
        },
      });

      expect(server.calls[0].requestHeaders).toMatchObject({
        authorization: 'Bearer test-api-key',
        'cartesia-version': '2026-03-01',
        'custom-provider-header': 'provider-header-value',
        'custom-request-header': 'request-header-value',
      });
    });

    it('should include user-agent header', async () => {
      prepareAudioResponse();

      await model.doGenerate({
        text: 'Hello, world!',
        voice: 'test-voice-id',
      });

      expect(server.calls[0].requestUserAgent).toContain(
        `ai-sdk/cartesia/0.0.0-test`,
      );
    });

    it('should return audio data', async () => {
      const audio = new Uint8Array(100);
      prepareAudioResponse();

      const result = await model.doGenerate({
        text: 'Hello, world!',
        voice: 'test-voice-id',
      });

      expect(result.audio).toStrictEqual(audio);
    });

    it('should include response data with timestamp, modelId and headers', async () => {
      prepareAudioResponse({
        headers: {
          'x-request-id': 'test-request-id',
        },
      });

      const testDate = new Date(0);
      const customModel = new CartesiaSpeechModel('sonic-3.5', {
        provider: 'test-provider',
        url: () => 'https://api.cartesia.ai/tts/bytes',
        headers: () => ({}),
        _internal: {
          currentDate: () => testDate,
        },
      });

      const result = await customModel.doGenerate({
        text: 'Hello, world!',
        voice: 'test-voice-id',
      });

      expect(result.response).toMatchObject({
        timestamp: testDate,
        modelId: 'sonic-3.5',
        headers: {
          'content-type': 'audio/mp3',
          'x-request-id': 'test-request-id',
        },
      });
    });
  });
});
