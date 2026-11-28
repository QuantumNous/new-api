import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { describe, it, expect, vi } from 'vitest';
import { createGoogleVertex } from './google-vertex-provider-base';
import { GoogleVertexTranscriptionModel } from './google-vertex-transcription-model';

vi.mock('./version', () => ({
  VERSION: '0.0.0-test',
}));

const provider = createGoogleVertex({
  project: 'test-project',
  location: 'us-central1',
});
const model = provider.transcription('chirp_2');

// 8 bytes of audio; base64 -> 'AQIDBAUGBwg='.
const audioData = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
const AUDIO_BASE64 = 'AQIDBAUGBwg=';

const url =
  'https://us-central1-speech.googleapis.com/v2/projects/test-project/locations/us-central1/recognizers/_:recognize';
const usUrl =
  'https://us-speech.googleapis.com/v2/projects/test-project/locations/us/recognizers/_:recognize';
const globalUrl =
  'https://speech.googleapis.com/v2/projects/test-project/locations/global/recognizers/_:recognize';

const defaultBody = {
  results: [
    {
      alternatives: [
        {
          transcript: 'hello world',
          words: [
            { word: 'hello', startOffset: '0s', endOffset: '0.500s' },
            { word: 'world', startOffset: '0.500s', endOffset: '1s' },
          ],
        },
      ],
      languageCode: 'en-US',
    },
  ],
  metadata: { totalBilledDuration: '1s' },
};

const server = createTestServer({
  [url]: {},
  [usUrl]: {},
  [globalUrl]: {},
});

function prepareJsonResponse({
  headers,
}: {
  headers?: Record<string, string>;
} = {}) {
  server.urls[url].response = {
    type: 'json-value',
    headers,
    body: defaultBody,
  };
}

describe('doGenerate', () => {
  it('should send the model, languageCodes, features and base64 content', async () => {
    prepareJsonResponse();

    await model.doGenerate({ audio: audioData, mediaType: 'audio/wav' });

    expect(await server.calls[0].requestBodyJson).toStrictEqual({
      config: {
        model: 'chirp_2',
        languageCodes: ['auto'],
        autoDecodingConfig: {},
        features: {
          enableWordTimeOffsets: true,
          enableAutomaticPunctuation: true,
        },
      },
      content: AUDIO_BASE64,
    });
  });

  it('should target the regional Speech-to-Text endpoint', async () => {
    prepareJsonResponse();

    await model.doGenerate({ audio: audioData, mediaType: 'audio/wav' });

    expect(server.calls[0].requestUrl).toBe(url);
  });

  it('should extract text, segments, language and duration', async () => {
    prepareJsonResponse();

    const result = await model.doGenerate({
      audio: audioData,
      mediaType: 'audio/wav',
    });

    expect(result.text).toBe('hello world');
    expect(result.segments).toEqual([
      { text: 'hello', startSecond: 0, endSecond: 0.5 },
      { text: 'world', startSecond: 0.5, endSecond: 1 },
    ]);
    // BCP-47 `en-US` is reduced to the ISO-639-1 `en`.
    expect(result.language).toBe('en');
    expect(result.durationInSeconds).toBe(1);
  });

  it('should accept a base64 string audio input directly', async () => {
    prepareJsonResponse();

    await model.doGenerate({ audio: AUDIO_BASE64, mediaType: 'audio/wav' });

    expect((await server.calls[0].requestBodyJson).content).toBe(AUDIO_BASE64);
  });

  it('should pass languageCodes and features from provider options', async () => {
    prepareJsonResponse();

    await model.doGenerate({
      audio: audioData,
      mediaType: 'audio/wav',
      providerOptions: {
        googleVertex: {
          languageCodes: ['en-US', 'fr-FR'],
          enableAutomaticPunctuation: false,
          enableWordTimeOffsets: false,
        },
      },
    });

    expect(await server.calls[0].requestBodyJson).toMatchObject({
      config: {
        languageCodes: ['en-US', 'fr-FR'],
        features: {
          enableAutomaticPunctuation: false,
          enableWordTimeOffsets: false,
        },
      },
    });
  });

  it('should accept the legacy vertex provider options key', async () => {
    server.urls[usUrl].response = { type: 'json-value', body: defaultBody };

    await model.doGenerate({
      audio: audioData,
      mediaType: 'audio/wav',
      providerOptions: { vertex: { region: 'us' } },
    });

    expect(server.calls[0].requestUrl).toBe(usUrl);
  });

  it('should accept the google provider options key', async () => {
    server.urls[usUrl].response = { type: 'json-value', body: defaultBody };

    await model.doGenerate({
      audio: audioData,
      mediaType: 'audio/wav',
      providerOptions: { google: { region: 'us' } },
    });

    expect(server.calls[0].requestUrl).toBe(usUrl);
  });

  it('should prefer googleVertex provider options', async () => {
    server.urls[usUrl].response = { type: 'json-value', body: defaultBody };

    await model.doGenerate({
      audio: audioData,
      mediaType: 'audio/wav',
      providerOptions: {
        googleVertex: { region: 'us' },
        vertex: { region: 'eu' },
        google: { region: 'asia-southeast1' },
      },
    });

    expect(server.calls[0].requestUrl).toBe(usUrl);
  });

  it('should route to a region override from provider options', async () => {
    server.urls[usUrl].response = { type: 'json-value', body: defaultBody };

    await model.doGenerate({
      audio: audioData,
      mediaType: 'audio/wav',
      providerOptions: { googleVertex: { region: 'us' } },
    });

    expect(server.calls[0].requestUrl).toBe(usUrl);
  });

  it('should use the unprefixed host for the global location', async () => {
    server.urls[globalUrl].response = { type: 'json-value', body: defaultBody };

    await provider.transcription('latest_long').doGenerate({
      audio: audioData,
      mediaType: 'audio/wav',
      providerOptions: { googleVertex: { region: 'global' } },
    });

    expect(server.calls[0].requestUrl).toBe(globalUrl);
  });

  it('should pass headers and user agent', async () => {
    prepareJsonResponse();

    const providerWithHeaders = createGoogleVertex({
      project: 'test-project',
      location: 'us-central1',
      headers: { 'Custom-Provider-Header': 'provider-header-value' },
    });

    await providerWithHeaders.transcription('chirp_2').doGenerate({
      audio: audioData,
      mediaType: 'audio/wav',
      headers: { 'Custom-Request-Header': 'request-header-value' },
    });

    expect(server.calls[0].requestHeaders).toMatchObject({
      'custom-provider-header': 'provider-header-value',
      'custom-request-header': 'request-header-value',
    });
    expect(server.calls[0].requestUserAgent).toContain(
      'ai-sdk/google-vertex/0.0.0-test',
    );
  });

  it('should return empty text and segments when there are no results', async () => {
    server.urls[url].response = { type: 'json-value', body: {} };

    const result = await model.doGenerate({
      audio: audioData,
      mediaType: 'audio/wav',
    });

    expect(result.text).toBe('');
    expect(result.segments).toEqual([]);
    expect(result.language).toBeUndefined();
    expect(result.durationInSeconds).toBeUndefined();
  });

  it('should omit segments without word time offsets', async () => {
    server.urls[url].response = {
      type: 'json-value',
      body: {
        results: [
          {
            alternatives: [
              {
                transcript: 'hello world',
                words: [{ word: 'hello' }, { word: 'world' }],
              },
            ],
            languageCode: 'en-US',
          },
        ],
      },
    };

    const result = await model.doGenerate({
      audio: audioData,
      mediaType: 'audio/wav',
    });

    expect(result.segments).toEqual([]);
  });

  it('should canonicalize detected languages to ISO-639-1', async () => {
    server.urls[url].response = {
      type: 'json-value',
      body: {
        results: [
          {
            alternatives: [{ transcript: '你好' }],
            languageCode: 'cmn-Hans-CN',
          },
        ],
      },
    };

    const result = await model.doGenerate({
      audio: audioData,
      mediaType: 'audio/wav',
    });

    expect(result.language).toBe('zh');
  });

  it('should omit detected languages without an ISO-639-1 code', async () => {
    server.urls[url].response = {
      type: 'json-value',
      body: {
        results: [
          {
            alternatives: [{ transcript: 'hello world' }],
            languageCode: 'ast-ES',
          },
        ],
      },
    };

    const result = await model.doGenerate({
      audio: audioData,
      mediaType: 'audio/wav',
    });

    expect(result.language).toBeUndefined();
  });

  it('should parse billed duration', async () => {
    server.urls[url].response = {
      type: 'json-value',
      body: {
        results: [
          {
            alternatives: [{ transcript: 'hello world' }],
            languageCode: 'en-US',
          },
        ],
        metadata: { totalBilledDuration: '1.250s' },
      },
    };

    const result = await model.doGenerate({
      audio: audioData,
      mediaType: 'audio/wav',
    });

    expect(result.durationInSeconds).toBe(1.25);
  });

  it('should include response data with timestamp, modelId and headers', async () => {
    prepareJsonResponse({ headers: { 'x-request-id': 'test-request-id' } });

    const testDate = new Date(0);
    const customModel = new GoogleVertexTranscriptionModel('chirp_2', {
      provider: 'google.vertex.transcription',
      project: 'test-project',
      location: 'us-central1',
      headers: () => ({}),
      _internal: { currentDate: () => testDate },
    });

    const result = await customModel.doGenerate({
      audio: audioData,
      mediaType: 'audio/wav',
    });

    expect(result.response.timestamp.getTime()).toBe(testDate.getTime());
    expect(result.response.modelId).toBe('chirp_2');
    expect(result.response.headers?.['x-request-id']).toBe('test-request-id');
  });
});
