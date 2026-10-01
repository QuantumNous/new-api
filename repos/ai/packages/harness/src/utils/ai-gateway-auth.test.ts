import { describe, expect, it } from 'vitest';
import { getAiGatewayAuthFromEnv } from './ai-gateway-auth';

describe('getAiGatewayAuthFromEnv', () => {
  it('prefers AI_GATEWAY_API_KEY over VERCEL_OIDC_TOKEN', () => {
    expect(
      getAiGatewayAuthFromEnv({
        env: {
          AI_GATEWAY_API_KEY: 'gateway-key',
          VERCEL_OIDC_TOKEN: 'oidc-token',
        },
      }),
    ).toEqual({
      apiKey: 'gateway-key',
      baseUrl: 'https://ai-gateway.vercel.sh',
    });
  });

  it('reads AI_GATEWAY_BASE_URL from env', () => {
    expect(
      getAiGatewayAuthFromEnv({
        env: {
          AI_GATEWAY_API_KEY: 'gateway-key',
          AI_GATEWAY_BASE_URL: 'https://gateway.example.com',
        },
      }),
    ).toEqual({
      apiKey: 'gateway-key',
      baseUrl: 'https://gateway.example.com',
    });
  });

  it('falls back to VERCEL_OIDC_TOKEN', () => {
    expect(
      getAiGatewayAuthFromEnv({ env: { VERCEL_OIDC_TOKEN: 'oidc-token' } }),
    ).toEqual({
      apiKey: 'oidc-token',
      baseUrl: 'https://ai-gateway.vercel.sh',
    });
  });

  it('returns undefined apiKey when no gateway auth env is configured', () => {
    expect(getAiGatewayAuthFromEnv({ env: {} })).toEqual({
      apiKey: undefined,
      baseUrl: 'https://ai-gateway.vercel.sh',
    });
  });
});
