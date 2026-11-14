import { describe, expect, it, vi } from 'vitest';
import { resolveClaudeCodeEnv } from './claude-code-auth';

const noHelper = () => undefined;

describe('resolveClaudeCodeEnv', () => {
  it('uses explicit anthropic auth when given', () => {
    const env = resolveClaudeCodeEnv(
      { anthropic: { apiKey: 'sk-explicit' } },
      { ANTHROPIC_API_KEY: 'sk-process', AI_GATEWAY_API_KEY: 'gw-key' },
      { readApiKeyHelper: noHelper },
    );
    expect(env).toEqual({ ANTHROPIC_API_KEY: 'sk-explicit' });
  });

  it('falls back to ANTHROPIC_* env when anthropic option is empty', () => {
    const env = resolveClaudeCodeEnv(
      { anthropic: {} },
      {
        ANTHROPIC_API_KEY: 'sk-process',
        ANTHROPIC_BASE_URL: 'https://api.example.com',
      },
      { readApiKeyHelper: noHelper },
    );
    expect(env).toEqual({
      ANTHROPIC_API_KEY: 'sk-process',
      ANTHROPIC_BASE_URL: 'https://api.example.com',
    });
  });

  it('routes through the gateway when gateway option is given', () => {
    const env = resolveClaudeCodeEnv(
      { gateway: { apiKey: 'gw-explicit' } },
      {},
      { readApiKeyHelper: noHelper },
    );
    expect(env.AI_GATEWAY_API_KEY).toBe('gw-explicit');
    expect(env.ANTHROPIC_API_KEY).toBe('gw-explicit');
    expect(env.ANTHROPIC_BASE_URL).toBe('https://ai-gateway.vercel.sh');
  });

  it('uses env gateway auth when gateway option only sets base URL', () => {
    const env = resolveClaudeCodeEnv(
      { gateway: { baseUrl: 'https://gw.example' } },
      { VERCEL_OIDC_TOKEN: 'oidc-env' },
      { readApiKeyHelper: noHelper },
    );
    expect(env).toEqual({
      AI_GATEWAY_API_KEY: 'oidc-env',
      ANTHROPIC_API_KEY: 'oidc-env',
      AI_GATEWAY_BASE_URL: 'https://gw.example',
      ANTHROPIC_BASE_URL: 'https://gw.example',
    });
  });

  it('auto-detects gateway when AI_GATEWAY_API_KEY is set', () => {
    const env = resolveClaudeCodeEnv(
      undefined,
      { AI_GATEWAY_API_KEY: 'gw-auto' },
      { readApiKeyHelper: noHelper },
    );
    expect(env.AI_GATEWAY_API_KEY).toBe('gw-auto');
    expect(env.ANTHROPIC_API_KEY).toBe('gw-auto');
  });

  it('auto-detects gateway when VERCEL_OIDC_TOKEN is set', () => {
    const env = resolveClaudeCodeEnv(
      undefined,
      { VERCEL_OIDC_TOKEN: 'oidc-auto' },
      { readApiKeyHelper: noHelper },
    );
    expect(env.AI_GATEWAY_API_KEY).toBe('oidc-auto');
    expect(env.ANTHROPIC_API_KEY).toBe('oidc-auto');
    expect(env.AI_GATEWAY_BASE_URL).toBe('https://ai-gateway.vercel.sh');
    expect(env.ANTHROPIC_BASE_URL).toBe('https://ai-gateway.vercel.sh');
  });

  it('auto-detects direct anthropic when only ANTHROPIC_API_KEY is set', () => {
    const env = resolveClaudeCodeEnv(
      undefined,
      { ANTHROPIC_API_KEY: 'sk-auto' },
      { readApiKeyHelper: noHelper },
    );
    expect(env).toEqual({ ANTHROPIC_API_KEY: 'sk-auto' });
  });

  it('forwards host ANTHROPIC_BASE_URL alongside the api key', () => {
    const env = resolveClaudeCodeEnv(
      undefined,
      {
        ANTHROPIC_API_KEY: 'sk-auto',
        ANTHROPIC_BASE_URL: 'https://ai-gateway.vercel.sh',
      },
      { readApiKeyHelper: noHelper },
    );
    expect(env).toEqual({
      ANTHROPIC_API_KEY: 'sk-auto',
      ANTHROPIC_BASE_URL: 'https://ai-gateway.vercel.sh',
    });
  });

  it('forwards a base URL alongside the apiKeyHelper-supplied credentials', () => {
    const env = resolveClaudeCodeEnv(
      undefined,
      { ANTHROPIC_BASE_URL: 'https://ai-gateway.vercel.sh' },
      { readApiKeyHelper: () => 'vck_from_helper' },
    );
    expect(env).toEqual({
      ANTHROPIC_API_KEY: 'vck_from_helper',
      ANTHROPIC_AUTH_TOKEN: 'vck_from_helper',
      ANTHROPIC_BASE_URL: 'https://ai-gateway.vercel.sh',
    });
  });

  it('populates both ANTHROPIC_API_KEY and ANTHROPIC_AUTH_TOKEN from the apiKeyHelper', () => {
    const env = resolveClaudeCodeEnv(
      undefined,
      {},
      { readApiKeyHelper: () => 'vck_from_helper' },
    );
    expect(env).toEqual({
      ANTHROPIC_API_KEY: 'vck_from_helper',
      ANTHROPIC_AUTH_TOKEN: 'vck_from_helper',
    });
  });

  it('prefers a static ANTHROPIC_API_KEY over the apiKeyHelper', () => {
    const helper = vi.fn(() => 'sk-from-helper');
    const env = resolveClaudeCodeEnv(
      undefined,
      { ANTHROPIC_API_KEY: 'sk-static' },
      { readApiKeyHelper: helper },
    );
    expect(env.ANTHROPIC_API_KEY).toBe('sk-static');
  });

  it('returns an empty env when nothing is configured', () => {
    const env = resolveClaudeCodeEnv(
      undefined,
      {},
      {
        readApiKeyHelper: noHelper,
      },
    );
    expect(env).toEqual({});
  });
});
