import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { ElevenLabsTranscriptionModel } from './elevenlabs-transcription-model';
import { createElevenLabs } from './elevenlabs-provider';
import { readFile } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./version', () => ({
  VERSION: '0.0.0-test',
}));

const audioData = await readFile(path.join(__dirname, 'transcript-test.mp3'));
const provider = createElevenLabs({ apiKey: 'test-api-key' });
const model = provider.transcription('scribe_v1');

const server = createTestServer({
  'https://api.elevenlabs.io/v1/speech-to-text': {},
});

function prepareJsonFixtureResponse(
  filename: string,
  headers?: Record<string, string>,
) {
  server.urls['https://api.elevenlabs.io/v1/speech-to-text'].response = {
    type: 'json-value',
    headers,
    body: JSON.parse(
      fs.readFileSync(`src/__fixtures__/${filename}.json`, 'utf8'),
    ),
  };
}

describe('doGenerate', () => {
  describe('transcription', () => {
    beforeEach(() => prepareJsonFixtureResponse('elevenlabs-transcription'));

    it('should pass the model', async () => {
      await model.doGenerate({
        audio: audioData,
        mediaType: 'audio/wav',
      });

      expect(await server.calls[0].requestBodyMultipart).toMatchObject({
        model_id: 'scribe_v1',
      });
    });

    it('should pass headers', async () => {
      const provider = createElevenLabs({
        apiKey: 'test-api-key',
        headers: {
          'Custom-Provider-Header': 'provider-header-value',
        },
      });

      await provider.transcription('scribe_v1').doGenerate({
        audio: audioData,
        mediaType: 'audio/wav',
        headers: {
          'Custom-Request-Header': 'request-header-value',
        },
      });

      expect(server.calls[0].requestHeaders).toMatchObject({
        'xi-api-key': 'test-api-key',
        'content-type': expect.stringMatching(
          /^multipart\/form-data; boundary=----formdata-undici-\d+$/,
        ),
        'custom-provider-header': 'provider-header-value',
        'custom-request-header': 'request-header-value',
      });
      expect(server.calls[0].requestUserAgent).toContain(
        `ai-sdk/elevenlabs/0.0.0-test`,
      );
    });

    it('should extract the transcription text', async () => {
      const result = await model.doGenerate({
        audio: audioData,
        mediaType: 'audio/wav',
      });

      expect(result.text).toMatchInlineSnapshot(
        `"Hello from the Vercel AI SDK."`,
      );
    });

    it('should pass provider options correctly', async () => {
      await model.doGenerate({
        audio: audioData,
        mediaType: 'audio/wav',
        providerOptions: {
          elevenlabs: {
            languageCode: 'en',
            fileFormat: 'pcm_s16le_16',
            tagAudioEvents: false,
            numSpeakers: 2,
            timestampsGranularity: 'character',
            diarize: true,
          },
        },
      });

      const body = await server.calls[0].requestBodyMultipart;
      expect(body!.file).toBeInstanceOf(File);
      const { file: _, ...rest } = body!;
      expect(rest).toMatchInlineSnapshot(`
        {
          "diarize": "true",
          "file_format": "pcm_s16le_16",
          "language_code": "en",
          "model_id": "scribe_v1",
          "num_speakers": "2",
          "tag_audio_events": "false",
          "timestamps_granularity": "character",
        }
      `);
    });
  });

  describe('response headers', () => {
    it('should include response data with timestamp, modelId and headers', async () => {
      prepareJsonFixtureResponse('elevenlabs-transcription', {
        'x-request-id': 'test-request-id',
        'x-ratelimit-remaining': '123',
      });

      const testDate = new Date(0);
      const customModel = new ElevenLabsTranscriptionModel('scribe_v1', {
        provider: 'test-provider',
        url: () => 'https://api.elevenlabs.io/v1/speech-to-text',
        headers: () => ({}),
        _internal: {
          currentDate: () => testDate,
        },
      });

      const result = await customModel.doGenerate({
        audio: audioData,
        mediaType: 'audio/wav',
      });

      expect(result.response).toMatchSnapshot();
    });
  });

  describe('response metadata', () => {
    it('should use real date when no custom date provider is specified', async () => {
      prepareJsonFixtureResponse('elevenlabs-transcription');

      const testDate = new Date(0);
      const customModel = new ElevenLabsTranscriptionModel('scribe_v1', {
        provider: 'test-provider',
        url: () => 'https://api.elevenlabs.io/v1/speech-to-text',
        headers: () => ({}),
        _internal: {
          currentDate: () => testDate,
        },
      });

      const result = await customModel.doGenerate({
        audio: audioData,
        mediaType: 'audio/wav',
      });

      expect(result.response.timestamp.getTime()).toEqual(testDate.getTime());
      expect(result.response.modelId).toBe('scribe_v1');
    });
  });

  describe('no additional formats', () => {
    it('should work when no additional formats are returned', async () => {
      prepareJsonFixtureResponse('elevenlabs-transcription');

      const testDate = new Date(0);
      const customModel = new ElevenLabsTranscriptionModel('scribe_v1', {
        provider: 'test-provider',
        url: () => 'https://api.elevenlabs.io/v1/speech-to-text',
        headers: () => ({}),
        _internal: {
          currentDate: () => testDate,
        },
      });

      const result = await customModel.doGenerate({
        audio: audioData,
        mediaType: 'audio/wav',
      });

      expect(result).toMatchSnapshot();
    });
  });
});
