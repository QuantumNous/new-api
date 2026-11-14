import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { GladiaTranscriptionModel } from './gladia-transcription-model';
import { createGladia } from './gladia-provider';
import { readFile } from 'node:fs/promises';
import * as fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./version', () => ({
  VERSION: '0.0.0-test',
}));

const audioData = await readFile(path.join(__dirname, 'transcript-test.mp3'));
const provider = createGladia({ apiKey: 'test-api-key' });
const model = provider.transcription();

const uploadFixture = JSON.parse(
  fs.readFileSync('src/__fixtures__/gladia-upload.json', 'utf8'),
);
const initiateFixture = JSON.parse(
  fs.readFileSync('src/__fixtures__/gladia-initiate.json', 'utf8'),
);
const resultFixture = JSON.parse(
  fs.readFileSync('src/__fixtures__/gladia-result.json', 'utf8'),
);

const server = createTestServer({
  'https://api.gladia.io/v2/upload': {
    response: {
      type: 'json-value',
      body: uploadFixture,
    },
  },
  'https://api.gladia.io/v2/pre-recorded': {},
  [initiateFixture.result_url]: {},
  'https://cdn.evil.example/v2/pre-recorded/result': {},
});

function prepareJsonFixtureResponse(headers?: Record<string, string>) {
  server.urls['https://api.gladia.io/v2/pre-recorded'].response = {
    type: 'json-value',
    headers,
    body: initiateFixture,
  };
  server.urls[initiateFixture.result_url].response = {
    type: 'json-value',
    headers,
    body: resultFixture,
  };
}

describe('doGenerate', () => {
  describe('transcription', () => {
    beforeEach(() => prepareJsonFixtureResponse());

    it('should pass audio_url to pre-recorded endpoint', async () => {
      await model.doGenerate({
        audio: audioData,
        mediaType: 'audio/wav',
      });

      expect(await server.calls[1].requestBodyJson).toMatchObject({
        audio_url: uploadFixture.audio_url,
      });
    });

    it('does not send the API key when the result URL is on a foreign origin', async () => {
      const foreignResultUrl =
        'https://cdn.evil.example/v2/pre-recorded/result';
      server.urls['https://api.gladia.io/v2/pre-recorded'].response = {
        type: 'json-value',
        body: { ...initiateFixture, result_url: foreignResultUrl },
      };
      server.urls[foreignResultUrl].response = {
        type: 'json-value',
        body: resultFixture,
      };

      await model.doGenerate({
        audio: audioData,
        mediaType: 'audio/wav',
      });

      const pollCall = server.calls.find(
        call => call.requestUrl === foreignResultUrl,
      );
      expect(pollCall).toBeDefined();
      expect(pollCall!.requestHeaders['x-gladia-key']).toBeUndefined();
    });

    it('should pass headers', async () => {
      const provider = createGladia({
        apiKey: 'test-api-key',
        headers: {
          'Custom-Provider-Header': 'provider-header-value',
        },
      });

      await provider.transcription().doGenerate({
        audio: audioData,
        mediaType: 'audio/wav',
        headers: {
          'Custom-Request-Header': 'request-header-value',
        },
      });

      expect(server.calls[1].requestHeaders).toMatchObject({
        'x-gladia-key': 'test-api-key',
        'content-type': 'application/json',
        'custom-provider-header': 'provider-header-value',
        'custom-request-header': 'request-header-value',
      });
      expect(server.calls[0].requestUserAgent).toContain(
        `ai-sdk/gladia/0.0.0-test`,
      );
    });

    it('should extract the transcription text', async () => {
      const result = await model.doGenerate({
        audio: audioData,
        mediaType: 'audio/wav',
      });

      expect(result.text).toBe(
        resultFixture.result.transcription.full_transcript,
      );
    });

    it('should generate full response', async () => {
      const testDate = new Date(0);
      const customModel = new GladiaTranscriptionModel('default', {
        provider: 'test-provider',
        url: ({ path }) => `https://api.gladia.io${path}`,
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

  describe('response headers', () => {
    beforeEach(() =>
      prepareJsonFixtureResponse({
        'x-request-id': 'test-request-id',
        'x-ratelimit-remaining': '123',
      }),
    );

    it('should include response headers', async () => {
      const testDate = new Date(0);
      const customModel = new GladiaTranscriptionModel('default', {
        provider: 'test-provider',
        url: ({ path }) => `https://api.gladia.io${path}`,
        headers: () => ({}),
        _internal: {
          currentDate: () => testDate,
        },
      });

      const result = await customModel.doGenerate({
        audio: audioData,
        mediaType: 'audio/wav',
      });

      expect(result.response).toMatchObject({
        timestamp: testDate,
        modelId: 'default',
        headers: {
          'content-type': 'application/json',
          'x-request-id': 'test-request-id',
          'x-ratelimit-remaining': '123',
        },
      });
    });
  });

  describe('response metadata', () => {
    beforeEach(() => prepareJsonFixtureResponse());

    it('should include timestamp and modelId', async () => {
      const testDate = new Date(0);
      const customModel = new GladiaTranscriptionModel('default', {
        provider: 'test-provider',
        url: ({ path }) => `https://api.gladia.io${path}`,
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
      expect(result.response.modelId).toBe('default');
    });
  });
});
