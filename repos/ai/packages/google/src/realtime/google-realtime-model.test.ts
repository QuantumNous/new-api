import { describe, it, expect, vi } from 'vitest';
import { GoogleRealtimeModel } from './google-realtime-model';
import type { GoogleRealtimeModelOptions } from './google-realtime-model-options';

describe('GoogleRealtimeModel', () => {
  describe('doCreateClientSecret', () => {
    it('calls auth_tokens endpoint with correct payload', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          name: 'projects/123/locations/us/accessTokens/abc',
          expireTime: '2026-01-01T00:05:00.000Z',
        }),
      });

      const model = new GoogleRealtimeModel('gemini-2.0-flash-live-001', {
        provider: 'google.realtime',
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
        headers: () => ({ 'x-goog-api-key': 'test-key' }),
        fetch: mockFetch,
      });

      const result = await model.doCreateClientSecret({
        sessionConfig: {
          instructions: 'Be helpful',
          voice: 'Puck',
        },
      });

      expect(mockFetch).toHaveBeenCalledOnce();

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe(
        'https://generativelanguage.googleapis.com/v1alpha/auth_tokens?key=test-key',
      );
      expect(options.method).toBe('POST');

      const body = JSON.parse(options.body);
      expect(body.uses).toBe(0);
      expect(body.expireTime).toBeDefined();
      expect(body.bidiGenerateContentSetup.model).toBe(
        'models/gemini-2.0-flash-live-001',
      );
      expect(body.bidiGenerateContentSetup.systemInstruction).toEqual({
        parts: [{ text: 'Be helpful' }],
      });
      expect(
        body.bidiGenerateContentSetup.generationConfig.speechConfig.voiceConfig
          .prebuiltVoiceConfig.voiceName,
      ).toBe('Puck');

      expect(result.token).toBe('projects/123/locations/us/accessTokens/abc');
      expect(result.url).toContain('generativelanguage.googleapis.com');
    });

    it('sets newSessionExpireTime from expiresAfterSeconds', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ name: 'token', expireTime: undefined }),
      });

      const model = new GoogleRealtimeModel('gemini-2.0-flash-live-001', {
        provider: 'google.realtime',
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
        headers: () => ({ 'x-goog-api-key': 'test-key' }),
        fetch: mockFetch,
      });

      const before = Date.now();
      await model.doCreateClientSecret({ expiresAfterSeconds: 120 });
      const after = Date.now();

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);

      // newSessionExpireTime controls the window to open a session.
      const newSessionExpireMs = new Date(body.newSessionExpireTime).getTime();
      expect(newSessionExpireMs).toBeGreaterThanOrEqual(before + 120_000);
      expect(newSessionExpireMs).toBeLessThanOrEqual(after + 120_000);

      // expireTime is the overall token lifetime and must outlast the open
      // window so the opened session has room to run.
      expect(new Date(body.expireTime).getTime()).toBeGreaterThan(
        newSessionExpireMs,
      );
    });

    it('uses the configured base URL for realtime endpoints', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ name: 'token' }),
      });

      const model = new GoogleRealtimeModel('gemini-2.0-flash-live-001', {
        provider: 'google.realtime',
        baseURL: 'https://proxy.example.com/google/v1beta',
        headers: () => ({ 'x-goog-api-key': 'test-key' }),
        fetch: mockFetch,
      });

      const result = await model.doCreateClientSecret({});

      expect(mockFetch).toHaveBeenCalledWith(
        'https://proxy.example.com/google/v1alpha/auth_tokens?key=test-key',
        expect.any(Object),
      );
      expect(result.url).toBe(
        'wss://proxy.example.com/google/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained',
      );
    });

    it('uses ws protocol for http base URLs', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ name: 'token' }),
      });

      const model = new GoogleRealtimeModel('gemini-2.0-flash-live-001', {
        provider: 'google.realtime',
        baseURL: 'http://localhost:8787/v1beta',
        headers: () => ({ 'x-goog-api-key': 'test-key' }),
        fetch: mockFetch,
      });

      const result = await model.doCreateClientSecret({});

      expect(result.url).toBe(
        'ws://localhost:8787/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained',
      );
    });

    it('enables output audio transcription when configured', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ name: 'token' }),
      });

      const model = new GoogleRealtimeModel('gemini-2.0-flash-live-001', {
        provider: 'google.realtime',
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
        headers: () => ({ 'x-goog-api-key': 'test-key' }),
        fetch: mockFetch,
      });

      await model.doCreateClientSecret({
        sessionConfig: { outputAudioTranscription: {} },
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.bidiGenerateContentSetup.outputAudioTranscription).toEqual(
        {},
      );
    });

    it('embeds Google Live Translation config in auth token setup', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ name: 'token' }),
      });

      const model = new GoogleRealtimeModel(
        'gemini-3.5-live-translate-preview',
        {
          provider: 'google.realtime',
          baseURL: 'https://generativelanguage.googleapis.com/v1beta',
          headers: () => ({ 'x-goog-api-key': 'test-key' }),
          fetch: mockFetch,
        },
      );

      await model.doCreateClientSecret({
        sessionConfig: {
          providerOptions: {
            google: {
              translationConfig: {
                targetLanguageCode: 'pl',
                echoTargetLanguage: true,
              },
            } satisfies GoogleRealtimeModelOptions,
          },
        },
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(
        body.bidiGenerateContentSetup.generationConfig.translationConfig,
      ).toEqual({
        targetLanguageCode: 'pl',
        echoTargetLanguage: true,
      });
      expect(body.bidiGenerateContentSetup.google).toBeUndefined();
    });

    it('throws on missing API key', async () => {
      const model = new GoogleRealtimeModel('gemini-2.0-flash-live-001', {
        provider: 'google.realtime',
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
        headers: () => ({}),
      });

      await expect(model.doCreateClientSecret({})).rejects.toThrow(
        'API key is required',
      );
    });

    it('throws on failed request', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => 'Forbidden',
      });

      const model = new GoogleRealtimeModel('gemini-2.0-flash-live-001', {
        provider: 'google.realtime',
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
        headers: () => ({ 'x-goog-api-key': 'test-key' }),
        fetch: mockFetch,
      });

      await expect(model.doCreateClientSecret({})).rejects.toThrow(
        '403 Forbidden',
      );
    });
  });

  describe('getWebSocketConfig', () => {
    it('returns URL with access_token query param', () => {
      const model = new GoogleRealtimeModel('gemini-2.0-flash-live-001', {
        provider: 'google.realtime',
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
        headers: () => ({ 'x-goog-api-key': 'test-key' }),
      });

      const config = model.getWebSocketConfig({
        token: 'my-token',
        url: 'wss://example.com/ws',
      });

      expect(config.url).toBe('wss://example.com/ws?access_token=my-token');
      expect(config.protocols).toBeUndefined();
    });
  });

  describe('parseServerEvent', () => {
    it('delegates to mapper', () => {
      const model = new GoogleRealtimeModel('gemini-2.0-flash-live-001', {
        provider: 'google.realtime',
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
        headers: () => ({ 'x-goog-api-key': 'test-key' }),
      });

      const result = model.parseServerEvent({ setupComplete: true });
      expect(result).toEqual({
        type: 'session-created',
        raw: { setupComplete: true },
      });
    });
  });

  describe('serializeClientEvent', () => {
    it('delegates to mapper', () => {
      const model = new GoogleRealtimeModel('gemini-2.0-flash-live-001', {
        provider: 'google.realtime',
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
        headers: () => ({ 'x-goog-api-key': 'test-key' }),
      });

      const result = model.serializeClientEvent({
        type: 'input-audio-append',
        audio: 'base64',
      });
      expect(result).toEqual({
        realtimeInput: {
          audio: { data: 'base64', mimeType: 'audio/pcm;rate=16000' },
        },
      });
    });

    it('labels input audio with the configured capture rate', () => {
      const model = new GoogleRealtimeModel('gemini-2.0-flash-live-001', {
        provider: 'google.realtime',
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
        headers: () => ({ 'x-goog-api-key': 'test-key' }),
      });

      // The session-update carries the configured capture rate; later input
      // audio blobs must advertise that real rate, not a hardcoded 16000.
      model.serializeClientEvent({
        type: 'session-update',
        config: { inputAudioFormat: { type: 'audio/pcm', rate: 24000 } },
      });

      const result = model.serializeClientEvent({
        type: 'input-audio-append',
        audio: 'base64',
      });
      expect(result).toEqual({
        realtimeInput: {
          audio: { data: 'base64', mimeType: 'audio/pcm;rate=24000' },
        },
      });
    });
  });
});
