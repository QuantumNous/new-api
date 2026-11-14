import { AuthStorage, ModelRegistry } from '@earendil-works/pi-coding-agent';
import { describe, expect, it, vi } from 'vitest';
import { resolvePiEnv } from './pi-auth';

function makeRegistries() {
  const authStorage = AuthStorage.inMemory();
  const modelRegistry = ModelRegistry.inMemory(authStorage);
  const setRuntimeApiKey = vi.spyOn(authStorage, 'setRuntimeApiKey');
  const registerProvider = vi.spyOn(modelRegistry, 'registerProvider');
  return { authStorage, modelRegistry, setRuntimeApiKey, registerProvider };
}

describe('resolvePiEnv', () => {
  it('uses explicit gateway settings when configured', () => {
    const r = makeRegistries();
    const env = resolvePiEnv({
      options: { gateway: { apiKey: 'gw-key', baseUrl: 'https://gw.example' } },
      env: {},
      registries: {
        authStorage: r.authStorage,
        modelRegistry: r.modelRegistry,
      },
    });
    expect(env).toEqual({
      AI_GATEWAY_API_KEY: 'gw-key',
      AI_GATEWAY_BASE_URL: 'https://gw.example',
    });
    expect(r.setRuntimeApiKey).toHaveBeenCalledWith(
      'vercel-ai-gateway',
      'gw-key',
    );
    expect(r.registerProvider).toHaveBeenCalledWith('vercel-ai-gateway', {
      apiKey: 'gw-key',
      baseUrl: 'https://gw.example',
      authHeader: true,
      headers: {
        'User-Agent': 'ai-sdk/harness-pi/0.0.0-test',
        'x-client-app': 'ai-sdk/harness-pi/0.0.0-test',
      },
    });
  });

  it('uses env gateway auth when explicit gateway only sets base URL', () => {
    const r = makeRegistries();
    const env = resolvePiEnv({
      options: { gateway: { baseUrl: 'https://gw.example' } },
      env: { VERCEL_OIDC_TOKEN: 'oidc-env' },
      registries: {
        authStorage: r.authStorage,
        modelRegistry: r.modelRegistry,
      },
    });
    expect(env).toEqual({
      AI_GATEWAY_API_KEY: 'oidc-env',
      AI_GATEWAY_BASE_URL: 'https://gw.example',
    });
    expect(r.registerProvider).toHaveBeenCalledWith('vercel-ai-gateway', {
      apiKey: 'oidc-env',
      baseUrl: 'https://gw.example',
      authHeader: true,
      headers: {
        'User-Agent': 'ai-sdk/harness-pi/0.0.0-test',
        'x-client-app': 'ai-sdk/harness-pi/0.0.0-test',
      },
    });
  });

  it('uses customEnv when provided and registers all known providers', () => {
    const r = makeRegistries();
    const env = resolvePiEnv({
      options: {
        customEnv: {
          AI_GATEWAY_API_KEY: 'gw',
          OPENAI_API_KEY: 'oai',
          ANTHROPIC_API_KEY: 'ant',
          ANTHROPIC_AUTH_TOKEN: 'tok',
        },
      },
      env: {},
      registries: {
        authStorage: r.authStorage,
        modelRegistry: r.modelRegistry,
      },
    });
    expect(env.AI_GATEWAY_API_KEY).toBe('gw');
    const registeredProviders = r.registerProvider.mock.calls
      .map(call => call[0])
      .sort();
    expect(registeredProviders).toEqual([
      'anthropic',
      'openai',
      'vercel-ai-gateway',
    ]);
    const anthropicCall = r.registerProvider.mock.calls.find(
      call => call[0] === 'anthropic',
    );
    expect(anthropicCall?.[1].headers).toEqual({
      authorization: 'Bearer tok',
    });
    const gatewayCall = r.registerProvider.mock.calls.find(
      call => call[0] === 'vercel-ai-gateway',
    );
    expect(gatewayCall?.[1].headers).toEqual({
      'User-Agent': 'ai-sdk/harness-pi/0.0.0-test',
      'x-client-app': 'ai-sdk/harness-pi/0.0.0-test',
    });
  });

  it('registers arbitrary <PREFIX>_API_KEY + <PREFIX>_BASE_URL via customEnv', () => {
    const r = makeRegistries();
    resolvePiEnv({
      options: {
        customEnv: {
          MISTRAL_API_KEY: 'mk',
          MISTRAL_BASE_URL: 'https://api.mistral.example',
        },
      },
      env: {},
      registries: {
        authStorage: r.authStorage,
        modelRegistry: r.modelRegistry,
      },
    });
    expect(r.setRuntimeApiKey).toHaveBeenCalledWith('mistral', 'mk');
    expect(r.registerProvider).toHaveBeenCalledWith('mistral', {
      apiKey: 'mk',
      baseUrl: 'https://api.mistral.example',
      authHeader: true,
    });
  });

  it('falls back to ambient AI_GATEWAY_API_KEY when no options', () => {
    const r = makeRegistries();
    const env = resolvePiEnv({
      options: undefined,
      env: {
        AI_GATEWAY_API_KEY: 'ambient',
        AI_GATEWAY_BASE_URL: 'https://amb',
      },
      registries: {
        authStorage: r.authStorage,
        modelRegistry: r.modelRegistry,
      },
    });
    expect(env).toEqual({
      AI_GATEWAY_API_KEY: 'ambient',
      AI_GATEWAY_BASE_URL: 'https://amb',
    });
    expect(r.registerProvider).toHaveBeenCalledWith('vercel-ai-gateway', {
      apiKey: 'ambient',
      baseUrl: 'https://amb',
      authHeader: true,
      headers: {
        'User-Agent': 'ai-sdk/harness-pi/0.0.0-test',
        'x-client-app': 'ai-sdk/harness-pi/0.0.0-test',
      },
    });
  });

  it('falls back to ambient VERCEL_OIDC_TOKEN when AI_GATEWAY_API_KEY is missing', () => {
    const r = makeRegistries();
    const env = resolvePiEnv({
      options: undefined,
      env: { VERCEL_OIDC_TOKEN: 'oidc' },
      registries: {
        authStorage: r.authStorage,
        modelRegistry: r.modelRegistry,
      },
    });
    expect(env.AI_GATEWAY_API_KEY).toBe('oidc');
  });

  it('returns {} when no auth is configured anywhere', () => {
    const r = makeRegistries();
    const env = resolvePiEnv({
      options: undefined,
      env: {},
      registries: {
        authStorage: r.authStorage,
        modelRegistry: r.modelRegistry,
      },
    });
    expect(env).toEqual({});
    expect(r.setRuntimeApiKey).not.toHaveBeenCalled();
    expect(r.registerProvider).not.toHaveBeenCalled();
  });
});
