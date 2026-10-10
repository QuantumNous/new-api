import type { LanguageModelV4CallOptions } from '@ai-sdk/provider';
import { defaultSettingsMiddleware } from './default-settings-middleware';
import { MockLanguageModelV4 } from '../test/mock-language-model-v4';
import { describe, it, expect } from 'vitest';

const BASE_PARAMS: LanguageModelV4CallOptions = {
  prompt: [
    { role: 'user', content: [{ type: 'text', text: 'Hello, world!' }] },
  ],
};

const MOCK_MODEL = new MockLanguageModelV4();

describe('defaultSettingsMiddleware', () => {
  describe('transformParams', () => {
    it('should apply default settings', async () => {
      const middleware = defaultSettingsMiddleware({
        settings: { temperature: 0.7 },
      });

      const result = await middleware.transformParams!({
        type: 'generate',
        params: { ...BASE_PARAMS },
        model: MOCK_MODEL,
      });

      expect(result.temperature).toBe(0.7);
    });

    it('should give precedence to user-provided settings', async () => {
      const middleware = defaultSettingsMiddleware({
        settings: { temperature: 0.7 },
      });

      const result = await middleware.transformParams!({
        type: 'generate',
        params: {
          ...BASE_PARAMS,
          temperature: 0.5,
        },
        model: MOCK_MODEL,
      });

      expect(result.temperature).toBe(0.5);
    });

    it('should merge provider metadata with default settings', async () => {
      const middleware = defaultSettingsMiddleware({
        settings: {
          temperature: 0.7,
          providerOptions: {
            anthropic: {
              cacheControl: { type: 'ephemeral' },
            },
          },
        },
      });

      const result = await middleware.transformParams!({
        type: 'generate',
        params: { ...BASE_PARAMS },
        model: MOCK_MODEL,
      });

      expect(result.temperature).toBe(0.7);
      expect(result.providerOptions).toEqual({
        anthropic: {
          cacheControl: { type: 'ephemeral' },
        },
      });
    });

    it('should merge complex provider metadata objects', async () => {
      const middleware = defaultSettingsMiddleware({
        settings: {
          providerOptions: {
            anthropic: {
              cacheControl: { type: 'ephemeral' },
              feature: { enabled: true },
            },
            openai: {
              logit_bias: { '50256': -100 },
            },
          },
        },
      });

      const result = await middleware.transformParams!({
        type: 'generate',
        params: {
          ...BASE_PARAMS,
          providerOptions: {
            anthropic: {
              feature: { enabled: false },
              otherSetting: 'value',
            },
          },
        },
        model: MOCK_MODEL,
      });

      expect(result.providerOptions).toEqual({
        anthropic: {
          cacheControl: { type: 'ephemeral' },
          feature: { enabled: false },
          otherSetting: 'value',
        },
        openai: {
          logit_bias: { '50256': -100 },
        },
      });
    });

    it('should handle nested provider metadata objects correctly', async () => {
      const middleware = defaultSettingsMiddleware({
        settings: {
          providerOptions: {
            anthropic: {
              tools: {
                retrieval: { enabled: true },
                math: { enabled: true },
              },
            },
          },
        },
      });

      const result = await middleware.transformParams!({
        type: 'generate',
        params: {
          ...BASE_PARAMS,
          providerOptions: {
            anthropic: {
              tools: {
                retrieval: { enabled: false },
                code: { enabled: true },
              },
            },
          },
        },
        model: MOCK_MODEL,
      });

      expect(result.providerOptions).toEqual({
        anthropic: {
          tools: {
            retrieval: { enabled: false },
            math: { enabled: true },
            code: { enabled: true },
          },
        },
      });
    });
  });

  describe('temperature', () => {
    it('should keep 0 if settings.temperature is not set', async () => {
      const middleware = defaultSettingsMiddleware({
        settings: {},
      });

      const result = await middleware.transformParams!({
        type: 'generate',
        params: { ...BASE_PARAMS, temperature: 0 },
        model: MOCK_MODEL,
      });

      expect(result.temperature).toBe(0);
    });

    it('should use default temperature if param temperature is undefined', async () => {
      const middleware = defaultSettingsMiddleware({
        settings: { temperature: 0.7 },
      });

      const result = await middleware.transformParams!({
        type: 'generate',
        params: { ...BASE_PARAMS, temperature: undefined },
        model: MOCK_MODEL,
      });

      expect(result.temperature).toBe(0.7);
    });

    it('should not use default temperature if param temperature is null', async () => {
      const middleware = defaultSettingsMiddleware({
        settings: { temperature: 0.7 },
      });

      const result = await middleware.transformParams!({
        type: 'generate',
        params: { ...BASE_PARAMS, temperature: null as any },
        model: MOCK_MODEL,
      });

      expect(result.temperature).toBe(null);
    });

    it('should use param temperature by default', async () => {
      const middleware = defaultSettingsMiddleware({
        settings: { temperature: 0.7 },
      });

      const result = await middleware.transformParams!({
        type: 'generate',
        params: { ...BASE_PARAMS, temperature: 0.9 },
        model: MOCK_MODEL,
      });

      expect(result.temperature).toBe(0.9);
    });
  });

  describe('other settings', () => {
    it('should apply default maxOutputTokens', async () => {
      const middleware = defaultSettingsMiddleware({
        settings: { maxOutputTokens: 100 },
      });
      const result = await middleware.transformParams!({
        type: 'generate',
        params: BASE_PARAMS,
        model: MOCK_MODEL,
      });
      expect(result.maxOutputTokens).toBe(100);
    });

    it('should prioritize param maxOutputTokens', async () => {
      const middleware = defaultSettingsMiddleware({
        settings: { maxOutputTokens: 100 },
      });
      const result = await middleware.transformParams!({
        type: 'generate',
        params: { ...BASE_PARAMS, maxOutputTokens: 50 },
        model: MOCK_MODEL,
      });
      expect(result.maxOutputTokens).toBe(50);
    });

    it('should apply default stopSequences', async () => {
      const middleware = defaultSettingsMiddleware({
        settings: { stopSequences: ['stop'] },
      });
      const result = await middleware.transformParams!({
        type: 'generate',
        params: BASE_PARAMS,
        model: MOCK_MODEL,
      });
      expect(result.stopSequences).toEqual(['stop']);
    });

    it('should prioritize param stopSequences', async () => {
      const middleware = defaultSettingsMiddleware({
        settings: { stopSequences: ['stop'] },
      });
      const result = await middleware.transformParams!({
        type: 'generate',
        params: { ...BASE_PARAMS, stopSequences: ['end'] },
        model: MOCK_MODEL,
      });
      expect(result.stopSequences).toEqual(['end']);
    });

    it('should apply default topP', async () => {
      const middleware = defaultSettingsMiddleware({ settings: { topP: 0.9 } });
      const result = await middleware.transformParams!({
        type: 'generate',
        params: BASE_PARAMS,
        model: MOCK_MODEL,
      });
      expect(result.topP).toBe(0.9);
    });

    it('should prioritize param topP', async () => {
      const middleware = defaultSettingsMiddleware({ settings: { topP: 0.9 } });
      const result = await middleware.transformParams!({
        type: 'generate',
        params: { ...BASE_PARAMS, topP: 0.5 },
        model: MOCK_MODEL,
      });
      expect(result.topP).toBe(0.5);
    });
  });

  describe('headers', () => {
    it('should merge headers', async () => {
      const middleware = defaultSettingsMiddleware({
        settings: {
          headers: { 'X-Custom-Header': 'test', 'X-Another-Header': 'test2' },
        },
      });

      const result = await middleware.transformParams!({
        type: 'generate',
        params: {
          ...BASE_PARAMS,
          headers: { 'X-Custom-Header': 'test2' },
        },
        model: MOCK_MODEL,
      });

      expect(result.headers).toEqual({
        'X-Custom-Header': 'test2',
        'X-Another-Header': 'test2',
      });
    });

    it('should handle empty default headers', async () => {
      const middleware = defaultSettingsMiddleware({
        settings: { headers: {} },
      });
      const result = await middleware.transformParams!({
        type: 'generate',
        params: { ...BASE_PARAMS, headers: { 'X-Param-Header': 'param' } },
        model: MOCK_MODEL,
      });
      expect(result.headers).toEqual({ 'X-Param-Header': 'param' });
    });

    it('should handle empty param headers', async () => {
      const middleware = defaultSettingsMiddleware({
        settings: { headers: { 'X-Default-Header': 'default' } },
      });
      const result = await middleware.transformParams!({
        type: 'generate',
        params: { ...BASE_PARAMS, headers: {} },
        model: MOCK_MODEL,
      });
      expect(result.headers).toEqual({ 'X-Default-Header': 'default' });
    });

    it('should handle both headers being undefined', async () => {
      const middleware = defaultSettingsMiddleware({
        settings: {},
      });
      const result = await middleware.transformParams!({
        type: 'generate',
        params: { ...BASE_PARAMS },
        model: MOCK_MODEL,
      });
      expect(result.headers).toBeUndefined();
    });
  });

  describe('providerOptions', () => {
    it('should handle empty default providerOptions', async () => {
      const middleware = defaultSettingsMiddleware({
        settings: { providerOptions: {} },
      });
      const result = await middleware.transformParams!({
        type: 'generate',
        params: {
          ...BASE_PARAMS,
          providerOptions: { openai: { user: 'param-user' } },
        },
        model: MOCK_MODEL,
      });
      expect(result.providerOptions).toEqual({
        openai: { user: 'param-user' },
      });
    });

    it('should handle empty param providerOptions', async () => {
      const middleware = defaultSettingsMiddleware({
        settings: { providerOptions: { anthropic: { user: 'default-user' } } },
      });
      const result = await middleware.transformParams!({
        type: 'generate',
        params: { ...BASE_PARAMS, providerOptions: {} },
        model: MOCK_MODEL,
      });
      expect(result.providerOptions).toEqual({
        anthropic: { user: 'default-user' },
      });
    });

    it('should handle both providerOptions being undefined', async () => {
      const middleware = defaultSettingsMiddleware({
        settings: {},
      });
      const result = await middleware.transformParams!({
        type: 'generate',
        params: { ...BASE_PARAMS },
        model: MOCK_MODEL,
      });
      expect(result.providerOptions).toBeUndefined();
    });
  });
});
