import { describe, expect, it } from 'vitest';
import { resolveDeepAgentsEnv } from './deepagents-auth';

describe('resolveDeepAgentsEnv', () => {
  it('pins explicit anthropic auth', () => {
    const env = resolveDeepAgentsEnv({
      auth: {
        anthropic: { apiKey: 'sk-ant', baseUrl: 'https://example.test' },
      },
      processEnv: {},
    });
    expect(env).toEqual({
      ANTHROPIC_API_KEY: 'sk-ant',
      ANTHROPIC_BASE_URL: 'https://example.test',
    });
  });

  it('passes through an anthropic auth token', () => {
    const env = resolveDeepAgentsEnv({
      auth: { anthropic: { authToken: 'tok' } },
      processEnv: {},
    });
    expect(env).toEqual({ ANTHROPIC_AUTH_TOKEN: 'tok' });
  });

  it('routes through the gateway anthropic endpoint (no /v1 suffix)', () => {
    const env = resolveDeepAgentsEnv({
      auth: { gateway: { apiKey: 'gw-key' } },
      processEnv: {},
    });
    expect(env.AI_GATEWAY_API_KEY).toBe('gw-key');
    expect(env.ANTHROPIC_API_KEY).toBe('gw-key');
    expect(env.ANTHROPIC_BASE_URL).toBe('https://ai-gateway.vercel.sh');
  });

  it('trims a trailing slash from a custom gateway base url', () => {
    const env = resolveDeepAgentsEnv({
      auth: { gateway: { apiKey: 'gw-key', baseUrl: 'https://gw.test/' } },
      processEnv: {},
    });
    expect(env.ANTHROPIC_BASE_URL).toBe('https://gw.test');
  });

  it('prefers explicit anthropic auth over ambient gateway creds', () => {
    const env = resolveDeepAgentsEnv({
      auth: { anthropic: { apiKey: 'sk-ant' } },
      processEnv: { AI_GATEWAY_API_KEY: 'ambient-gw' },
    });
    expect(env).toEqual({ ANTHROPIC_API_KEY: 'sk-ant' });
  });

  it('falls back to ambient gateway env before ambient anthropic creds', () => {
    const env = resolveDeepAgentsEnv({
      processEnv: {
        AI_GATEWAY_API_KEY: 'ambient-gw',
        ANTHROPIC_API_KEY: 'ambient-ant',
      },
    });
    expect(env.AI_GATEWAY_API_KEY).toBe('ambient-gw');
    expect(env.ANTHROPIC_API_KEY).toBe('ambient-gw');
    expect(env.ANTHROPIC_BASE_URL).toBe('https://ai-gateway.vercel.sh');
  });

  it('falls back to ambient OIDC token as the gateway key', () => {
    const env = resolveDeepAgentsEnv({
      processEnv: { VERCEL_OIDC_TOKEN: 'oidc-token' },
    });
    expect(env.AI_GATEWAY_API_KEY).toBe('oidc-token');
  });

  it('falls back to ambient anthropic when no gateway creds exist', () => {
    const env = resolveDeepAgentsEnv({
      processEnv: { ANTHROPIC_API_KEY: 'ambient-ant' },
    });
    expect(env).toEqual({ ANTHROPIC_API_KEY: 'ambient-ant' });
  });
});
