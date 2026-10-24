import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { AssemblyAITranscriptionModel } from './assemblyai-transcription-model';
import { createAssemblyAI } from './assemblyai-provider';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, it, expect, vi } from 'vitest';

vi.mock('./version', () => ({
  VERSION: '0.0.0-test',
}));

const audioData = await readFile(path.join(__dirname, 'transcript-test.mp3'));
const provider = createAssemblyAI({ apiKey: 'test-api-key' });
const model = provider.transcription('best');

const server = createTestServer({
  'https://api.assemblyai.com/v2/transcript': {},
  'https://api.assemblyai.com/v2/transcript/9ea68fd3-f953-42c1-9742-976c447fb463':
    {},
  'https://api.assemblyai.com/v2/upload': {
    response: {
      type: 'json-value',
      body: {
        id: '9ea68fd3-f953-42c1-9742-976c447fb463',
        upload_url: 'https://storage.assemblyai.com/mock-upload-url',
      },
    },
  },
});

describe('doGenerate', () => {
  function prepareJsonResponse({
    headers,
  }: {
    headers?: Record<string, string>;
  } = {}) {
    server.urls['https://api.assemblyai.com/v2/transcript'].response = {
      type: 'json-value',
      body: {
        id: '9ea68fd3-f953-42c1-9742-976c447fb463',
        status: 'queued',
      },
    };

    server.urls[
      'https://api.assemblyai.com/v2/transcript/9ea68fd3-f953-42c1-9742-976c447fb463'
    ].response = {
      type: 'json-value',
      headers,
      body: {
        id: '9ea68fd3-f953-42c1-9742-976c447fb463',
        audio_url: 'https://assembly.ai/test.mp3',
        status: 'completed',
        webhook_auth: true,
        auto_highlights: true,
        redact_pii: true,
        summarization: true,
        language_model: 'assemblyai_default',
        acoustic_model: 'assemblyai_default',
        language_code: 'en_us',
        language_detection: true,
        language_confidence_threshold: 0.7,
        language_confidence: 0.9959,
        speech_model: 'best',
        text: 'Hello, world!',
        words: [
          {
            confidence: 0.97465,
            start: 250,
            end: 650,
            text: 'Hello,',
            channel: 'channel',
            speaker: 'speaker',
          },
          {
            confidence: 0.99999,
            start: 730,
            end: 1022,
            text: 'world',
            channel: 'channel',
            speaker: 'speaker',
          },
        ],
        utterances: [
          {
            confidence: 0.9359033333333334,
            start: 250,
            end: 26950,
            text: 'Hello, world!',
            words: [
              {
                confidence: 0.97503,
                start: 250,
                end: 650,
                text: 'Hello,',
                speaker: 'A',
              },
              {
                confidence: 0.99999,
                start: 730,
                end: 1022,
                text: 'world',
                speaker: 'A',
              },
            ],
            speaker: 'A',
            channel: 'channel',
          },
        ],
        confidence: 0.9404651451800253,
        audio_duration: 281,
        punctuate: true,
        format_text: true,
        disfluencies: false,
        multichannel: false,
        audio_channels: 1,
        webhook_url: 'https://your-webhook-url.tld/path',
        webhook_status_code: 200,
        webhook_auth_header_name: 'webhook-secret',
        auto_highlights_result: {
          status: 'success',
          results: [
            {
              count: 1,
              rank: 0.08,
              text: 'Hello, world!',
              timestamps: [
                {
                  start: 250,
                  end: 26950,
                },
              ],
            },
          ],
        },
        audio_start_from: 10,
        audio_end_at: 280,
        word_boost: ['hello', 'world'],
        boost_param: 'high',
        filter_profanity: true,
        redact_pii_audio: true,
        redact_pii_audio_quality: 'mp3',
        redact_pii_policies: [
          'us_social_security_number',
          'credit_card_number',
        ],
        redact_pii_sub: 'hash',
        speaker_labels: true,
        speakers_expected: 2,
        content_safety: true,
        content_safety_labels: {
          status: 'success',
          results: [
            {
              text: 'Hello, world!',
              labels: [
                {
                  label: 'disasters',
                  confidence: 0.8142836093902588,
                  severity: 0.4093044400215149,
                },
              ],
              sentences_idx_start: 0,
              sentences_idx_end: 5,
              timestamp: {
                start: 250,
                end: 28840,
              },
            },
          ],
          summary: {
            disasters: 0.9940800441842205,
            health_issues: 0.9216489289040967,
          },
          severity_score_summary: {
            disasters: {
              low: 0.5733263024656846,
              medium: 0.42667369753431533,
              high: 0,
            },
            health_issues: {
              low: 0.22863814977924785,
              medium: 0.45014154926938227,
              high: 0.32122030095136983,
            },
          },
        },
        iab_categories: true,
        iab_categories_result: {
          status: 'success',
          results: [
            {
              text: 'Hello, world!',
              labels: [
                {
                  relevance: 0.988274097442627,
                  label: 'Home&Garden>IndoorEnvironmentalQuality',
                },
                {
                  relevance: 0.5821335911750793,
                  label: 'NewsAndPolitics>Weather',
                },
              ],
              timestamp: {
                start: 250,
                end: 28840,
              },
            },
          ],
          summary: {
            'NewsAndPolitics>Weather': 1,
            'Home&Garden>IndoorEnvironmentalQuality': 0.9043831825256348,
          },
        },
        auto_chapters: true,
        chapters: [
          {
            gist: 'Hello, world!',
            headline: 'Hello, world!',
            summary: 'Hello, world!',
            start: 250,
            end: 28840,
          },
          {
            gist: 'Hello, world!',
            headline: 'Hello, world!',
            summary: 'Hello, world!',
            start: 29610,
            end: 280340,
          },
        ],
        summary_type: 'bullets',
        summary_model: 'informative',
        summary: '- Hello, world!',
        sentiment_analysis: true,
        sentiment_analysis_results: [
          {
            text: 'Hello, world!',
            start: 250,
            end: 26950,
            sentiment: 'POSITIVE',
            confidence: 0.9,
            speaker: 'A',
          },
        ],
        entity_detection: true,
        entities: [
          {
            entity_type: 'location',
            text: 'Canada',
            start: 2548,
            end: 3130,
          },
          {
            entity_type: 'location',
            text: 'the US',
            start: 5498,
            end: 6382,
          },
        ],
        speech_threshold: 0.5,
        error: 'error',
        dual_channel: false,
        speed_boost: true,
      },
    };
  }

  it('should pass the legacy model via the speech_model parameter', async () => {
    prepareJsonResponse();

    const result = await model.doGenerate({
      audio: audioData,
      mediaType: 'audio/wav',
    });

    const requestBody = await server.calls[1].requestBodyJson;
    expect(requestBody).toMatchObject({
      audio_url: 'https://storage.assemblyai.com/mock-upload-url',
      speech_model: 'best',
    });
    expect(requestBody.speech_models).toBeUndefined();

    expect(result.warnings).toContainEqual({
      type: 'deprecated',
      setting: "model 'best'",
      message: expect.stringContaining('universal-3-5-pro'),
    });
    const [deprecation] = result.warnings.filter(
      warning => warning.type === 'deprecated',
    );
    expect(deprecation?.message).toContain(
      'https://www.assemblyai.com/docs/pre-recorded-audio/select-the-speech-model',
    );
  });

  it('should pass newer models via the speech_models parameter', async () => {
    prepareJsonResponse();

    const result = await provider
      .transcription('universal-3-5-pro')
      .doGenerate({
        audio: audioData,
        mediaType: 'audio/wav',
      });

    const requestBody = await server.calls[1].requestBodyJson;
    expect(requestBody).toMatchObject({
      audio_url: 'https://storage.assemblyai.com/mock-upload-url',
      speech_models: ['universal-3-5-pro'],
    });
    expect(requestBody.speech_model).toBeUndefined();

    // No deprecation and no nudge for the latest flagship model.
    expect(result.warnings).toEqual([]);
  });

  it('should route universal-3-pro via speech_models and nudge to universal-3-5-pro', async () => {
    prepareJsonResponse();

    const result = await provider.transcription('universal-3-pro').doGenerate({
      audio: audioData,
      mediaType: 'audio/wav',
    });

    const requestBody = await server.calls[1].requestBodyJson;
    expect(requestBody.speech_models).toEqual(['universal-3-pro']);
    expect(requestBody.speech_model).toBeUndefined();

    // universal-3-pro is the model universal-3-5-pro replaces, so the message
    // names it explicitly.
    const [nudge] = result.warnings.filter(w => w.type === 'other');
    expect(nudge?.message).toContain('universal-3-5-pro');
    expect(nudge?.message).toContain("replace 'universal-3-pro'");
  });

  it('should nudge universal-2 users toward universal-3-5-pro', async () => {
    prepareJsonResponse();

    const result = await provider.transcription('universal-2').doGenerate({
      audio: audioData,
      mediaType: 'audio/wav',
    });

    // The nudge for universal-2 must not claim it is replaced by universal-3-pro.
    const [nudge] = result.warnings.filter(w => w.type === 'other');
    expect(nudge?.message).toContain('universal-3-5-pro');
    expect(nudge?.message).not.toContain("replace 'universal-3-pro'");
  });

  it('should not special-case the removed nano model', async () => {
    prepareJsonResponse();

    const result = await provider.transcription('nano').doGenerate({
      audio: audioData,
      mediaType: 'audio/wav',
    });

    // `nano` is no longer a legacy `speech_model` alias: it falls through to
    // `speech_models` (where the live API rejects it) and emits no warning.
    const requestBody = await server.calls[1].requestBodyJson;
    expect(requestBody.speech_models).toEqual(['nano']);
    expect(requestBody.speech_model).toBeUndefined();
    expect(
      result.warnings.filter(warning => warning.type === 'deprecated'),
    ).toEqual([]);
  });

  it('should still send provider options alongside speech_models', async () => {
    prepareJsonResponse();

    await provider.transcription('universal-3-5-pro').doGenerate({
      audio: audioData,
      mediaType: 'audio/wav',
      providerOptions: {
        assemblyai: {
          languageDetection: true,
          punctuate: false,
        },
      },
    });

    const requestBody = await server.calls[1].requestBodyJson;
    expect(requestBody).toMatchObject({
      speech_models: ['universal-3-5-pro'],
      language_detection: true,
      punctuate: false,
    });
  });

  it('should surface diarization + audio-intelligence via providerMetadata', async () => {
    prepareJsonResponse();

    const result = await provider
      .transcription('universal-3-5-pro')
      .doGenerate({
        audio: audioData,
        mediaType: 'audio/wav',
      });

    const metadata = result.providerMetadata?.assemblyai as
      | Record<string, any>
      | undefined;
    expect(metadata).toBeDefined();

    // Speaker diarization
    expect(metadata?.utterances?.[0]).toMatchObject({
      speaker: 'A',
      text: 'Hello, world!',
    });

    // Audio-intelligence results
    expect(metadata?.entities?.[0]).toMatchObject({
      entity_type: 'location',
      text: 'Canada',
    });
    expect(metadata?.sentimentAnalysisResults?.[0]).toMatchObject({
      sentiment: 'POSITIVE',
      text: 'Hello, world!',
    });
    expect(metadata?.contentSafetyLabels).toBeDefined();
    expect(metadata?.iabCategoriesResult).toBeDefined();
    expect(metadata?.autoHighlightsResult).toBeDefined();
  });

  it('should preserve the full raw response on response.body', async () => {
    prepareJsonResponse();

    const result = await provider
      .transcription('universal-3-5-pro')
      .doGenerate({
        audio: audioData,
        mediaType: 'audio/wav',
      });

    const body = result.response.body as Record<string, any>;
    // Word-level speaker label survives on the raw body.
    expect(body.words[0].speaker).toBe('speaker');
    // Fields not modeled in our schema (e.g. chapters, summary) are no longer
    // stripped — proves response.body is the raw response, not the parsed one.
    expect(body.chapters).toBeDefined();
    expect(body.summary).toBe('- Hello, world!');
  });

  it('should pass the Universal-3-Pro input params', async () => {
    prepareJsonResponse();

    await provider.transcription('universal-3-5-pro').doGenerate({
      audio: audioData,
      mediaType: 'audio/wav',
      providerOptions: {
        assemblyai: {
          prompt: 'This is a conversation about the AI SDK.',
          keytermsPrompt: ['Vercel', 'AI SDK'],
          temperature: 0.2,
          removeAudioTags: 'speaker',
          domain: 'medical-v1',
        },
      },
    });

    const requestBody = await server.calls[1].requestBodyJson;
    expect(requestBody).toMatchObject({
      speech_models: ['universal-3-5-pro'],
      prompt: 'This is a conversation about the AI SDK.',
      keyterms_prompt: ['Vercel', 'AI SDK'],
      temperature: 0.2,
      remove_audio_tags: 'speaker',
      domain: 'medical-v1',
    });
  });

  it('should pass the GA nested input params', async () => {
    prepareJsonResponse();

    await provider.transcription('universal-3-5-pro').doGenerate({
      audio: audioData,
      mediaType: 'audio/wav',
      providerOptions: {
        assemblyai: {
          redactPii: true,
          speakerOptions: { minSpeakersExpected: 1, maxSpeakersExpected: 3 },
          languageDetectionOptions: {
            expectedLanguages: ['en', 'es'],
            fallbackLanguage: 'en',
            codeSwitching: true,
            codeSwitchingConfidenceThreshold: 0.5,
          },
          redactPiiAudioOptions: {
            returnRedactedNoSpeechAudio: true,
            overrideAudioRedactionMethod: 'silence',
          },
          redactPiiReturnUnredacted: true,
          redactStaticEntities: { INTERNAL_TOOL: ['Bearclaw'] },
        },
      },
    });

    const requestBody = await server.calls[1].requestBodyJson;
    expect(requestBody).toMatchObject({
      speaker_options: { min_speakers_expected: 1, max_speakers_expected: 3 },
      language_detection_options: {
        expected_languages: ['en', 'es'],
        fallback_language: 'en',
        code_switching: true,
        code_switching_confidence_threshold: 0.5,
      },
      redact_pii_audio_options: {
        return_redacted_no_speech_audio: true,
        override_audio_redaction_method: 'silence',
      },
      redact_pii_return_unredacted: true,
      redact_static_entities: { INTERNAL_TOOL: ['Bearclaw'] },
    });
  });

  it('should warn when deprecated wordBoost/boostParam options are used', async () => {
    prepareJsonResponse();

    const result = await provider
      .transcription('universal-3-5-pro')
      .doGenerate({
        audio: audioData,
        mediaType: 'audio/wav',
        providerOptions: {
          assemblyai: { wordBoost: ['Vercel'], boostParam: 'high' },
        },
      });

    expect(result.warnings).toContainEqual({
      type: 'deprecated',
      setting: 'wordBoost, boostParam',
      message: expect.stringContaining('keytermsPrompt'),
    });
  });

  it('should attribute the deprecation warning to boostParam when only boostParam is set', async () => {
    prepareJsonResponse();

    const result = await provider
      .transcription('universal-3-5-pro')
      .doGenerate({
        audio: audioData,
        mediaType: 'audio/wav',
        providerOptions: { assemblyai: { boostParam: 'high' } },
      });

    expect(result.warnings).toContainEqual({
      type: 'deprecated',
      setting: 'boostParam',
      message: expect.stringContaining('keytermsPrompt'),
    });
  });

  it('should warn when redactPii-dependent options are set without redactPii', async () => {
    prepareJsonResponse();

    const result = await provider
      .transcription('universal-3-5-pro')
      .doGenerate({
        audio: audioData,
        mediaType: 'audio/wav',
        providerOptions: {
          assemblyai: { redactStaticEntities: { TOOL: ['Vercel'] } },
        },
      });

    expect(
      result.warnings.some(
        w => w.type === 'other' && w.message.includes('redactPii'),
      ),
    ).toBe(true);
  });

  it('should warn when redactPiiAudioOptions is set without redactPiiAudio', async () => {
    prepareJsonResponse();

    const result = await provider
      .transcription('universal-3-5-pro')
      .doGenerate({
        audio: audioData,
        mediaType: 'audio/wav',
        providerOptions: {
          assemblyai: {
            redactPii: true,
            redactPiiAudioOptions: { overrideAudioRedactionMethod: 'silence' },
          },
        },
      });

    expect(
      result.warnings.some(
        w => w.type === 'other' && w.message.includes('redactPiiAudio'),
      ),
    ).toBe(true);
  });

  it('should warn when languageCode and languageDetection are combined', async () => {
    prepareJsonResponse();

    const result = await provider
      .transcription('universal-3-5-pro')
      .doGenerate({
        audio: audioData,
        mediaType: 'audio/wav',
        providerOptions: {
          assemblyai: { languageCode: 'en', languageDetection: true },
        },
      });

    expect(
      result.warnings.some(
        w => w.type === 'other' && w.message.includes('languageDetection'),
      ),
    ).toBe(true);
  });

  it('should report segment timings in seconds (ms converted)', async () => {
    prepareJsonResponse();

    const result = await model.doGenerate({
      audio: audioData,
      mediaType: 'audio/wav',
    });

    // Fixture word[0] is start: 250ms, end: 650ms → 0.25s / 0.65s.
    expect(result.segments[0]).toEqual({
      text: 'Hello,',
      startSecond: 0.25,
      endSecond: 0.65,
    });
  });

  it('should pass headers', async () => {
    prepareJsonResponse();

    const provider = createAssemblyAI({
      apiKey: 'test-api-key',
      headers: {
        'Custom-Provider-Header': 'provider-header-value',
      },
    });

    await provider.transcription('best').doGenerate({
      audio: audioData,
      mediaType: 'audio/wav',
      headers: {
        'Custom-Request-Header': 'request-header-value',
      },
    });

    expect(server.calls[0].requestHeaders).toMatchObject({
      authorization: 'test-api-key',
      'content-type': 'application/octet-stream',
      'custom-provider-header': 'provider-header-value',
      'custom-request-header': 'request-header-value',
    });
    expect(server.calls[0].requestUserAgent).toContain(
      `ai-sdk/assemblyai/0.0.0-test`,
    );
  });

  it('should extract the transcription text', async () => {
    prepareJsonResponse();

    const result = await model.doGenerate({
      audio: audioData,
      mediaType: 'audio/wav',
    });

    expect(result.text).toBe('Hello, world!');
  });

  it('should include response data with timestamp, modelId and headers', async () => {
    prepareJsonResponse({
      headers: {
        'x-request-id': 'test-request-id',
        'x-ratelimit-remaining': '123',
      },
    });

    const testDate = new Date(0);
    const customModel = new AssemblyAITranscriptionModel('best', {
      provider: 'test-provider',
      url: ({ path }) => `https://api.assemblyai.com${path}`,
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
      modelId: 'best',
      headers: {
        'content-type': 'application/json',
        'x-request-id': 'test-request-id',
        'x-ratelimit-remaining': '123',
      },
    });
  });

  it('should use real date when no custom date provider is specified', async () => {
    prepareJsonResponse();

    const testDate = new Date(0);
    const customModel = new AssemblyAITranscriptionModel('best', {
      provider: 'test-provider',
      url: ({ path }) => `https://api.assemblyai.com${path}`,
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
    expect(result.response.modelId).toBe('best');
  });
});
