import { beforeEach, describe, it, expect } from 'vitest';
import {
  GoogleRealtimeEventMapper,
  buildGoogleSessionConfig,
} from './google-realtime-event-mapper';
import type { GoogleRealtimeModelOptions } from './google-realtime-model-options';

describe('GoogleRealtimeEventMapper', () => {
  describe('parseServerEvent', () => {
    it('maps setupComplete to session-created', () => {
      const mapper = new GoogleRealtimeEventMapper();
      const raw = { setupComplete: true };
      const result = mapper.parseServerEvent(raw);

      expect(result).toEqual({
        type: 'session-created',
        raw,
      });
    });

    it('maps serverContent with audio to audio-delta', () => {
      const mapper = new GoogleRealtimeEventMapper();
      const raw = {
        serverContent: {
          modelTurn: {
            parts: [{ inlineData: { data: 'base64audio' } }],
          },
        },
      };
      const result = mapper.parseServerEvent(raw);

      expect(result).toEqual({
        type: 'audio-delta',
        responseId: 'google-resp-0',
        itemId: 'google-item-0',
        delta: 'base64audio',
        raw,
      });
    });

    it('maps serverContent with text to text-delta', () => {
      const mapper = new GoogleRealtimeEventMapper();
      const raw = {
        serverContent: {
          modelTurn: {
            parts: [{ text: 'hello world' }],
          },
        },
      };
      const result = mapper.parseServerEvent(raw);

      expect(result).toEqual({
        type: 'text-delta',
        responseId: 'google-resp-0',
        itemId: 'google-item-0',
        delta: 'hello world',
        raw,
      });
    });

    it('maps serverContent with outputTranscription to audio-transcript-delta', () => {
      const mapper = new GoogleRealtimeEventMapper();
      const raw = {
        serverContent: {
          outputTranscription: { text: 'transcribed text' },
        },
      };
      const result = mapper.parseServerEvent(raw);

      expect(result).toEqual({
        type: 'audio-transcript-delta',
        responseId: 'google-resp-0',
        itemId: 'google-item-0',
        delta: 'transcribed text',
        raw,
      });
    });

    it('maps serverContent with inputTranscription to input-transcription-completed', () => {
      const mapper = new GoogleRealtimeEventMapper();
      const raw = {
        serverContent: {
          inputTranscription: { text: 'Can you hear me?' },
        },
      };
      const result = mapper.parseServerEvent(raw);

      expect(result).toEqual({
        type: 'input-transcription-completed',
        itemId: 'google-input-0',
        transcript: 'Can you hear me?',
        raw,
      });
    });

    it('maps top-level inputTranscription to input-transcription-completed', () => {
      const mapper = new GoogleRealtimeEventMapper();
      const raw = {
        inputTranscription: { text: 'Can you hear me?' },
      };
      const result = mapper.parseServerEvent(raw);

      expect(result).toEqual({
        type: 'input-transcription-completed',
        itemId: 'google-input-0',
        transcript: 'Can you hear me?',
        raw,
      });
    });

    it('maps serverContent with interrupted to speech-started', () => {
      const mapper = new GoogleRealtimeEventMapper();
      const raw = {
        serverContent: { interrupted: true },
      };
      const result = mapper.parseServerEvent(raw);

      expect(result).toEqual({
        type: 'speech-started',
        raw,
      });
    });

    it('maps serverContent with turnComplete after audio to done events + response-done', () => {
      const mapper = new GoogleRealtimeEventMapper();

      mapper.parseServerEvent({
        serverContent: {
          modelTurn: {
            parts: [{ inlineData: { data: 'audio' } }],
          },
        },
      });

      const raw = { serverContent: { turnComplete: true } };
      const result = mapper.parseServerEvent(raw);

      expect(result).toEqual([
        {
          type: 'audio-done',
          responseId: 'google-resp-0',
          itemId: 'google-item-0',
          raw,
        },
        {
          type: 'response-done',
          responseId: 'google-resp-0',
          status: 'completed',
          raw,
        },
      ]);
    });

    it('maps serverContent with turnComplete after text to done events + response-done', () => {
      const mapper = new GoogleRealtimeEventMapper();

      mapper.parseServerEvent({
        serverContent: {
          modelTurn: {
            parts: [{ text: 'hello' }],
          },
        },
      });

      const raw = { serverContent: { turnComplete: true } };
      const result = mapper.parseServerEvent(raw);

      expect(result).toEqual([
        {
          type: 'text-done',
          responseId: 'google-resp-0',
          itemId: 'google-item-0',
          raw,
        },
        {
          type: 'response-done',
          responseId: 'google-resp-0',
          status: 'completed',
          raw,
        },
      ]);
    });

    it('increments IDs after turnComplete', () => {
      const mapper = new GoogleRealtimeEventMapper();

      mapper.parseServerEvent({
        serverContent: {
          modelTurn: {
            parts: [{ inlineData: { data: 'audio1' } }],
          },
        },
      });

      mapper.parseServerEvent({
        serverContent: { turnComplete: true },
      });

      const raw = {
        serverContent: {
          modelTurn: {
            parts: [{ inlineData: { data: 'audio2' } }],
          },
        },
      };
      const result = mapper.parseServerEvent(raw);

      expect(result).toEqual({
        type: 'audio-delta',
        responseId: 'google-resp-1',
        itemId: 'google-item-1',
        delta: 'audio2',
        raw,
      });
    });

    it('keeps a late transcript attached to the just-completed turn', () => {
      const mapper = new GoogleRealtimeEventMapper();

      mapper.parseServerEvent({
        serverContent: {
          modelTurn: { parts: [{ inlineData: { data: 'audio1' } }] },
        },
      });

      mapper.parseServerEvent({ serverContent: { turnComplete: true } });

      // A transcript that arrives after turnComplete (Google delivers
      // transcription independently) must still reference the turn it belongs
      // to, not the next one. The counter only advances when new model content
      // actually arrives.
      const raw = {
        serverContent: { outputTranscription: { text: 'late transcript' } },
      };
      const result = mapper.parseServerEvent(raw);

      expect(result).toEqual({
        type: 'audio-transcript-delta',
        responseId: 'google-resp-0',
        itemId: 'google-item-0',
        delta: 'late transcript',
        raw,
      });

      // The next model response then opens turn 1.
      const next = mapper.parseServerEvent({
        serverContent: {
          modelTurn: { parts: [{ inlineData: { data: 'audio2' } }] },
        },
      });
      expect(next).toMatchObject({ responseId: 'google-resp-1' });
    });

    it('maps multi-part serverContent to multiple events', () => {
      const mapper = new GoogleRealtimeEventMapper();
      const raw = {
        serverContent: {
          modelTurn: {
            parts: [{ inlineData: { data: 'audio' } }, { text: 'text' }],
          },
        },
      };
      const result = mapper.parseServerEvent(raw);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual([
        {
          type: 'audio-delta',
          responseId: 'google-resp-0',
          itemId: 'google-item-0',
          delta: 'audio',
          raw,
        },
        {
          type: 'text-delta',
          responseId: 'google-resp-0',
          itemId: 'google-item-0',
          delta: 'text',
          raw,
        },
      ]);
    });

    it('maps toolCall to function-call-arguments-delta and done events', () => {
      const mapper = new GoogleRealtimeEventMapper();
      const raw = {
        toolCall: {
          functionCalls: [
            { id: 'call_1', name: 'getWeather', args: { city: 'NYC' } },
            { id: 'call_2', name: 'rollDice', args: {} },
          ],
        },
      };
      const result = mapper.parseServerEvent(raw);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual([
        {
          type: 'function-call-arguments-delta',
          responseId: 'google-resp-0',
          itemId: 'google-item-0',
          callId: 'call_1',
          delta: '{"city":"NYC"}',
          raw,
        },
        {
          type: 'function-call-arguments-done',
          responseId: 'google-resp-0',
          itemId: 'google-item-0',
          callId: 'call_1',
          name: 'getWeather',
          arguments: '{"city":"NYC"}',
          raw,
        },
        {
          type: 'function-call-arguments-delta',
          responseId: 'google-resp-0',
          itemId: 'google-item-0',
          callId: 'call_2',
          delta: '{}',
          raw,
        },
        {
          type: 'function-call-arguments-done',
          responseId: 'google-resp-0',
          itemId: 'google-item-0',
          callId: 'call_2',
          name: 'rollDice',
          arguments: '{}',
          raw,
        },
      ]);
    });

    it('maps toolCallCancellation to custom event', () => {
      const mapper = new GoogleRealtimeEventMapper();
      const raw = { toolCallCancellation: { ids: ['call_1'] } };
      const result = mapper.parseServerEvent(raw);

      expect(result).toEqual({
        type: 'custom',
        rawType: 'toolCallCancellation',
        raw,
      });
    });

    it('maps unrecognized top-level key to custom event', () => {
      const mapper = new GoogleRealtimeEventMapper();
      const raw = { somethingNew: { data: 123 } };
      const result = mapper.parseServerEvent(raw);

      expect(result).toEqual({
        type: 'custom',
        rawType: 'somethingNew',
        raw,
      });
    });
  });

  describe('serializeClientEvent', () => {
    let mapper: GoogleRealtimeEventMapper;

    beforeEach(() => {
      mapper = new GoogleRealtimeEventMapper();
    });

    it('serializes session-update as setup message', () => {
      const result = mapper.serializeClientEvent(
        { type: 'session-update', config: {} },
        'gemini-2.0-flash-live-001',
      );

      expect(result).toEqual({
        setup: {
          model: 'models/gemini-2.0-flash-live-001',
          generationConfig: {
            responseModalities: ['AUDIO'],
          },
        },
      });
    });

    it('serializes session-update with normalized session config', () => {
      const result = mapper.serializeClientEvent(
        {
          type: 'session-update',
          config: {
            instructions: 'Be helpful',
            voice: 'Puck',
            outputModalities: ['audio', 'text'],
            inputAudioFormat: { type: 'audio/pcm', rate: 24000 },
            tools: [
              {
                type: 'function',
                name: 'getWeather',
                description: 'Get weather',
                parameters: {
                  type: 'object',
                  properties: {
                    city: { type: 'string' },
                  },
                },
              },
            ],
          },
        },
        'gemini-2.0-flash-live-001',
      );

      expect(result).toEqual({
        setup: {
          model: 'models/gemini-2.0-flash-live-001',
          systemInstruction: {
            parts: [{ text: 'Be helpful' }],
          },
          generationConfig: {
            responseModalities: ['AUDIO', 'TEXT'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: 'Puck',
                },
              },
            },
          },
          tools: [
            {
              functionDeclarations: [
                {
                  name: 'getWeather',
                  description: 'Get weather',
                  parameters: {
                    type: 'object',
                    properties: {
                      city: { type: 'string' },
                    },
                  },
                },
              ],
            },
          ],
        },
      });
    });

    it('serializes live translation config into generationConfig', () => {
      const result = mapper.serializeClientEvent(
        {
          type: 'session-update',
          config: {
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            providerOptions: {
              google: {
                translationConfig: {
                  targetLanguageCode: 'pl',
                  echoTargetLanguage: true,
                },
              } satisfies GoogleRealtimeModelOptions,
            },
          },
        },
        'gemini-3.5-live-translate-preview',
      );

      expect(result).toEqual({
        setup: {
          model: 'models/gemini-3.5-live-translate-preview',
          generationConfig: {
            responseModalities: ['AUDIO'],
            translationConfig: {
              targetLanguageCode: 'pl',
              echoTargetLanguage: true,
            },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
      });
    });

    it('serializes input-audio-append as realtimeInput', () => {
      const result = mapper.serializeClientEvent(
        { type: 'input-audio-append', audio: 'base64data' },
        'model',
      );

      expect(result).toEqual({
        realtimeInput: {
          audio: {
            data: 'base64data',
            mimeType: 'audio/pcm;rate=16000',
          },
        },
      });
    });

    it('serializes input-audio-commit as audioStreamEnd', () => {
      expect(
        mapper.serializeClientEvent({ type: 'input-audio-commit' }, 'model'),
      ).toEqual({
        realtimeInput: {
          audioStreamEnd: true,
        },
      });
    });

    it('returns null for input-audio-clear', () => {
      expect(
        mapper.serializeClientEvent({ type: 'input-audio-clear' }, 'model'),
      ).toBeNull();
    });

    it('returns null for response-create', () => {
      expect(
        mapper.serializeClientEvent({ type: 'response-create' }, 'model'),
      ).toBeNull();
    });

    it('returns null for response-cancel', () => {
      expect(
        mapper.serializeClientEvent({ type: 'response-cancel' }, 'model'),
      ).toBeNull();
    });

    it('serializes text message as realtimeInput', () => {
      const result = mapper.serializeClientEvent(
        {
          type: 'conversation-item-create',
          item: { type: 'text-message', role: 'user', text: 'hello' },
        },
        'model',
      );

      expect(result).toEqual({
        realtimeInput: {
          text: 'hello',
        },
      });
    });

    it('serializes function-call-output as toolResponse', async () => {
      const result = await mapper.serializeClientEvent(
        {
          type: 'conversation-item-create',
          item: {
            type: 'function-call-output',
            callId: 'call_1',
            name: 'getWeather',
            output: '{"temp":72}',
          },
        },
        'model',
      );

      expect(result).toEqual({
        toolResponse: {
          functionResponses: [
            {
              id: 'call_1',
              name: 'getWeather',
              response: { temp: 72 },
            },
          ],
        },
      });
    });

    it('falls back to empty object for malformed function-call-output', async () => {
      const result = await mapper.serializeClientEvent(
        {
          type: 'conversation-item-create',
          item: {
            type: 'function-call-output',
            callId: 'call_1',
            name: 'getWeather',
            output: '{',
          },
        },
        'model',
      );

      expect(result).toEqual({
        toolResponse: {
          functionResponses: [
            {
              id: 'call_1',
              name: 'getWeather',
              response: {},
            },
          ],
        },
      });
    });

    it('returns null for conversation-item-truncate', () => {
      expect(
        mapper.serializeClientEvent(
          {
            type: 'conversation-item-truncate',
            itemId: 'item_1',
            contentIndex: 0,
            audioEndMs: 1000,
          },
          'model',
        ),
      ).toBeNull();
    });
  });
});

describe('buildGoogleSessionConfig', () => {
  it('builds config with model path', () => {
    const result = buildGoogleSessionConfig(undefined, 'gemini-2.0-flash');

    expect(result).toMatchInlineSnapshot(`
      {
        "generationConfig": {
          "responseModalities": [
            "AUDIO",
          ],
        },
        "model": "models/gemini-2.0-flash",
      }
    `);
  });

  it('builds config with instructions and voice', () => {
    const result = buildGoogleSessionConfig(
      {
        instructions: 'Be helpful',
        voice: 'Puck',
      },
      'gemini-2.0-flash',
    );

    expect(result).toMatchInlineSnapshot(`
      {
        "generationConfig": {
          "responseModalities": [
            "AUDIO",
          ],
          "speechConfig": {
            "voiceConfig": {
              "prebuiltVoiceConfig": {
                "voiceName": "Puck",
              },
            },
          },
        },
        "model": "models/gemini-2.0-flash",
        "systemInstruction": {
          "parts": [
            {
              "text": "Be helpful",
            },
          ],
        },
      }
    `);
  });

  it('builds config with tools', () => {
    const result = buildGoogleSessionConfig(
      {
        tools: [
          {
            type: 'function',
            name: 'getWeather',
            description: 'Get weather',
            parameters: {
              type: 'object',
              properties: {
                city: { type: 'string' },
              },
              required: ['city'],
            },
          },
        ],
      },
      'gemini-2.0-flash',
    );

    expect(result.tools).toMatchInlineSnapshot(`
      [
        {
          "functionDeclarations": [
            {
              "description": "Get weather",
              "name": "getWeather",
              "parameters": {
                "properties": {
                  "city": {
                    "type": "string",
                  },
                },
                "required": [
                  "city",
                ],
                "type": "object",
              },
            },
          ],
        },
      ]
    `);
  });

  it('maps output modalities to uppercase', () => {
    const result = buildGoogleSessionConfig(
      { outputModalities: ['audio', 'text'] },
      'model',
    );

    expect(
      (result.generationConfig as Record<string, unknown>).responseModalities,
    ).toEqual(['AUDIO', 'TEXT']);
  });

  it('enables input audio transcription', () => {
    const result = buildGoogleSessionConfig(
      { inputAudioTranscription: {} },
      'model',
    );

    expect(result.inputAudioTranscription).toEqual({});
  });

  it('enables output audio transcription', () => {
    const result = buildGoogleSessionConfig(
      { outputAudioTranscription: {} },
      'model',
    );

    expect(result.outputAudioTranscription).toEqual({});
  });

  it('maps providerOptions.google.translationConfig to generationConfig', () => {
    const result = buildGoogleSessionConfig(
      {
        providerOptions: {
          google: {
            translationConfig: {
              targetLanguageCode: 'es',
              echoTargetLanguage: true,
            },
          } satisfies GoogleRealtimeModelOptions,
        },
      },
      'gemini-3.5-live-translate-preview',
    );

    expect(result).toEqual({
      model: 'models/gemini-3.5-live-translate-preview',
      generationConfig: {
        responseModalities: ['AUDIO'],
        translationConfig: {
          targetLanguageCode: 'es',
          echoTargetLanguage: true,
        },
      },
    });
  });

  it('merges translation config into raw generationConfig provider options', () => {
    const result = buildGoogleSessionConfig(
      {
        providerOptions: {
          generationConfig: {
            responseModalities: ['AUDIO'],
            temperature: 0.2,
          },
          google: {
            translationConfig: {
              targetLanguageCode: 'fr',
            },
          } satisfies GoogleRealtimeModelOptions,
        },
      },
      'gemini-3.5-live-translate-preview',
    );

    expect(result.generationConfig).toEqual({
      responseModalities: ['AUDIO'],
      temperature: 0.2,
      translationConfig: {
        targetLanguageCode: 'fr',
      },
    });
  });

  it('preserves model path that already includes slash', () => {
    const result = buildGoogleSessionConfig(
      undefined,
      'models/gemini-2.0-flash',
    );
    expect(result.model).toBe('models/gemini-2.0-flash');
  });
});
