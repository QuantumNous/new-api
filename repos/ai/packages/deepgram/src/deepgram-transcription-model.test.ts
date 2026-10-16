import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { DeepgramTranscriptionModel } from './deepgram-transcription-model';
import { createDeepgram } from './deepgram-provider';
import { readFile } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./version', () => ({
  VERSION: '0.0.0-test',
}));

const audioData = await readFile(path.join(__dirname, 'transcript-test.mp3'));
const provider = createDeepgram({ apiKey: 'test-api-key' });
const model = provider.transcription('nova-3');

const server = createTestServer({
  'https://api.deepgram.com/v1/listen': {},
});

function prepareJsonFixtureResponse(
  filename: string,
  headers?: Record<string, string>,
) {
  server.urls['https://api.deepgram.com/v1/listen'].response = {
    type: 'json-value',
    headers,
    body: JSON.parse(
      fs.readFileSync(`src/__fixtures__/${filename}.json`, 'utf8'),
    ),
  };
}

describe('doGenerate', () => {
  describe('transcription', () => {
    beforeEach(() => prepareJsonFixtureResponse('deepgram-transcription'));

    it('should pass the model', async () => {
      await model.doGenerate({
        audio: audioData,
        mediaType: 'audio/wav',
      });

      expect(await server.calls[0].requestBodyMultipart).toMatchObject({});
    });

    it('should pass headers', async () => {
      const provider = createDeepgram({
        apiKey: 'test-api-key',
        headers: {
          'Custom-Provider-Header': 'provider-header-value',
        },
      });

      await provider.transcription('nova-3').doGenerate({
        audio: audioData,
        mediaType: 'audio/wav',
        headers: {
          'Custom-Request-Header': 'request-header-value',
        },
      });

      expect(server.calls[0].requestHeaders).toMatchObject({
        authorization: 'Token test-api-key',
        'content-type': 'audio/wav',
        'custom-provider-header': 'provider-header-value',
        'custom-request-header': 'request-header-value',
      });
      expect(server.calls[0].requestUserAgent).toContain(
        `ai-sdk/deepgram/0.0.0-test`,
      );
    });

    it('should extract the transcription text', async () => {
      const result = await model.doGenerate({
        audio: audioData,
        mediaType: 'audio/wav',
      });

      expect(result.text).toMatchInlineSnapshot(
        `"galileo was an american robotic space program that studied the planet jupiter and its moons as well as several other solar system bodies named after the italian astronomer galileo galilei the galileo spacecraft consisted of an orbiter and an atmospheric entry probe it was delivered into earth orbit on october eighteen nineteen eighty nine by space shuttle atlantis on the sts-thirty four mission and arrived at jupiter on december seven nineteen ninety five after gravity assist flybys of venus and earth and became the first spacecraft to orbit jupiter"`,
      );
    });

    it('should pass detectLanguage as detect_language query parameter', async () => {
      await model.doGenerate({
        audio: audioData,
        mediaType: 'audio/wav',
        providerOptions: {
          deepgram: {
            detectLanguage: true,
          },
        },
      });

      const requestUrl = server.calls[0].requestUrl;
      expect(requestUrl).toContain('detect_language=true');
    });

    it('should return detected language from response', async () => {
      const result = await model.doGenerate({
        audio: audioData,
        mediaType: 'audio/wav',
        providerOptions: {
          deepgram: {
            detectLanguage: true,
          },
        },
      });

      expect(result.language).toBe('en');
    });
  });

  describe('response headers', () => {
    it('should include response data with timestamp, modelId and headers', async () => {
      prepareJsonFixtureResponse('deepgram-transcription', {
        'x-request-id': 'test-request-id',
        'x-ratelimit-remaining': '123',
      });

      const testDate = new Date(0);
      const customModel = new DeepgramTranscriptionModel('nova-3', {
        provider: 'test-provider',
        url: () => 'https://api.deepgram.com/v1/listen',
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
      prepareJsonFixtureResponse('deepgram-transcription');

      const testDate = new Date(0);
      const customModel = new DeepgramTranscriptionModel('nova-3', {
        provider: 'test-provider',
        url: () => 'https://api.deepgram.com/v1/listen',
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
      expect(result.response.modelId).toBe('nova-3');
    });
  });

  describe('language detection', () => {
    it('should return detected language from inline response', async () => {
      server.urls['https://api.deepgram.com/v1/listen'].response = {
        type: 'json-value',
        body: {
          metadata: { duration: 1.0 },
          results: {
            channels: [
              {
                detected_language: 'sv',
                alternatives: [{ transcript: 'hej', words: [] }],
              },
            ],
          },
        },
      };

      const result = await model.doGenerate({
        audio: audioData,
        mediaType: 'audio/wav',
        providerOptions: {
          deepgram: {
            detectLanguage: true,
          },
        },
      });

      expect(result.language).toBe('sv');
    });

    it('should return undefined language when not detected', async () => {
      server.urls['https://api.deepgram.com/v1/listen'].response = {
        type: 'json-value',
        body: {
          metadata: { duration: 1.0 },
          results: {
            channels: [
              {
                alternatives: [{ transcript: 'hello', words: [] }],
              },
            ],
          },
        },
      };

      const result = await model.doGenerate({
        audio: audioData,
        mediaType: 'audio/wav',
      });

      expect(result.language).toBeUndefined();
    });
  });
});
