import { describe, expect, it } from 'vitest';
import { resolveCodexEnv } from './codex-auth';

describe('resolveCodexEnv', () => {
  it('uses openai-compatible auth when given', () => {
    const env = resolveCodexEnv(
      {
        openaiCompatible: {
          apiKey: 'sk-x',
          baseUrl: 'https://x.example.com',
          modelProviderName: 'X',
        },
      },
      {},
    );
    expect(env).toEqual({
      CODEX_API_KEY: 'sk-x',
      OPENAI_BASE_URL: 'https://x.example.com',
      CODEX_MODEL_PROVIDER_NAME: 'X',
    });
  });

  it('uses explicit openai auth when given', () => {
    const env = resolveCodexEnv(
      { openai: { apiKey: 'sk-direct', organization: 'org_1' } },
      { OPENAI_API_KEY: 'sk-env' },
    );
    expect(env.CODEX_API_KEY).toBe('sk-direct');
    expect(env.OPENAI_ORGANIZATION).toBe('org_1');
  });

  it('routes through the gateway when gateway option is given', () => {
    const env = resolveCodexEnv({ gateway: { apiKey: 'gw-key' } }, {});
    expect(env).toEqual({
      AI_GATEWAY_API_KEY: 'gw-key',
      CODEX_API_KEY: 'gw-key',
      AI_GATEWAY_BASE_URL: 'https://ai-gateway.vercel.sh/v1',
    });
  });

  it('appends /v1 to gateway base URLs for Codex', () => {
    const env = resolveCodexEnv(
      { gateway: { baseUrl: 'https://gw.example' } },
      { VERCEL_OIDC_TOKEN: 'oidc-env' },
    );
    expect(env).toEqual({
      AI_GATEWAY_API_KEY: 'oidc-env',
      CODEX_API_KEY: 'oidc-env',
      AI_GATEWAY_BASE_URL: 'https://gw.example/v1',
    });
  });

  it('uses env gateway auth when gateway option only sets base URL', () => {
    const env = resolveCodexEnv(
      { gateway: { baseUrl: 'https://gw.example/v1' } },
      { VERCEL_OIDC_TOKEN: 'oidc-env' },
    );
    expect(env).toEqual({
      AI_GATEWAY_API_KEY: 'oidc-env',
      CODEX_API_KEY: 'oidc-env',
      AI_GATEWAY_BASE_URL: 'https://gw.example/v1',
    });
  });

  it('auto-detects gateway when AI_GATEWAY_API_KEY is set', () => {
    const env = resolveCodexEnv(undefined, { AI_GATEWAY_API_KEY: 'gw-auto' });
    expect(env).toEqual({
      AI_GATEWAY_API_KEY: 'gw-auto',
      CODEX_API_KEY: 'gw-auto',
      AI_GATEWAY_BASE_URL: 'https://ai-gateway.vercel.sh/v1',
    });
  });

  it('auto-detects gateway when VERCEL_OIDC_TOKEN is set', () => {
    const env = resolveCodexEnv(undefined, { VERCEL_OIDC_TOKEN: 'oidc-auto' });
    expect(env).toEqual({
      AI_GATEWAY_API_KEY: 'oidc-auto',
      CODEX_API_KEY: 'oidc-auto',
      AI_GATEWAY_BASE_URL: 'https://ai-gateway.vercel.sh/v1',
    });
  });

  it('auto-detects direct openai when only OPENAI_API_KEY is set', () => {
    const env = resolveCodexEnv(undefined, { OPENAI_API_KEY: 'sk-auto' });
    expect(env).toEqual({ CODEX_API_KEY: 'sk-auto' });
  });

  it('forwards host OPENAI_BASE_URL alongside the api key', () => {
    const env = resolveCodexEnv(undefined, {
      OPENAI_API_KEY: 'sk-auto',
      OPENAI_BASE_URL: 'https://ai-gateway.vercel.sh',
    });
    expect(env).toEqual({
      CODEX_API_KEY: 'sk-auto',
      OPENAI_BASE_URL: 'https://ai-gateway.vercel.sh',
    });
  });

  it('returns an empty env when nothing is configured', () => {
    const env = resolveCodexEnv(undefined, {});
    expect(env).toEqual({});
  });
});
