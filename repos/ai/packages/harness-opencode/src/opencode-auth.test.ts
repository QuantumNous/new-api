import { describe, expect, it } from 'vitest';
import {
  resolveOpenCodeEnv,
  resolveOpenCodeProvider,
  splitOpenCodeModel,
  toOpenCodeGatewayBaseUrl,
} from './opencode-auth';

describe('OpenCode auth', () => {
  it('resolves provider from explicit provider or model prefix', () => {
    expect(resolveOpenCodeProvider({ provider: 'openai' })).toBe('openai');
    expect(resolveOpenCodeProvider({ model: 'openai/gpt-5.1' })).toBe('openai');
    expect(
      resolveOpenCodeProvider({ model: 'anthropic/claude-sonnet-4-5' }),
    ).toBe('anthropic');
    expect(resolveOpenCodeProvider({ model: 'custom/model' })).toBe(
      'anthropic',
    );
  });

  it('splits provider-prefixed models', () => {
    expect(
      splitOpenCodeModel('anthropic/claude-sonnet-4-5', undefined),
    ).toEqual({
      providerID: 'anthropic',
      modelID: 'claude-sonnet-4-5',
      model: 'anthropic/claude-sonnet-4-5',
    });
    expect(splitOpenCodeModel('gpt-5.1', 'openai')).toEqual({
      providerID: 'openai',
      modelID: 'gpt-5.1',
      model: 'openai/gpt-5.1',
    });
  });

  it('uses AI Gateway env including OIDC fallback', () => {
    expect(
      resolveOpenCodeEnv({
        auth: undefined,
        processEnv: {
          VERCEL_OIDC_TOKEN: 'oidc-token',
          AI_GATEWAY_BASE_URL: 'https://gateway.example',
        },
      }),
    ).toEqual({
      AI_GATEWAY_API_KEY: 'oidc-token',
      AI_GATEWAY_BASE_URL: 'https://gateway.example/v1',
    });
  });

  it('prefers selected direct provider auth before ambient gateway fallback', () => {
    expect(
      resolveOpenCodeEnv({
        auth: { openai: { apiKey: 'openai-key' } },
        provider: 'openai',
        processEnv: { AI_GATEWAY_API_KEY: 'gateway-key' },
      }),
    ).toEqual({ OPENAI_API_KEY: 'openai-key' });
  });

  it('uses explicit OpenAI-compatible auth regardless of selected provider', () => {
    expect(
      resolveOpenCodeEnv({
        auth: {
          openaiCompatible: {
            apiKey: 'compatible-key',
            baseUrl: 'https://compatible.example/v1',
            name: 'compatible',
            queryParams: { apiVersion: '2026-01-01' },
          },
        },
        provider: 'anthropic',
        processEnv: { AI_GATEWAY_API_KEY: 'gateway-key' },
      }),
    ).toEqual({
      OPENAI_API_KEY: 'compatible-key',
      OPENAI_BASE_URL: 'https://compatible.example/v1',
      OPENAI_NAME: 'compatible',
      OPENAI_QUERY_PARAMS_JSON: '{"apiVersion":"2026-01-01"}',
    });
  });

  it('normalizes OpenCode gateway base URLs to /v1', () => {
    expect(toOpenCodeGatewayBaseUrl('https://ai-gateway.vercel.sh')).toBe(
      'https://ai-gateway.vercel.sh/v1',
    );
    expect(toOpenCodeGatewayBaseUrl('https://ai-gateway.vercel.sh/v1')).toBe(
      'https://ai-gateway.vercel.sh/v1',
    );
  });
});
