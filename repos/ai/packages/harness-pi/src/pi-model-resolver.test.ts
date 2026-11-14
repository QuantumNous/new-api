import { AuthStorage, ModelRegistry } from '@earendil-works/pi-coding-agent';
import { describe, expect, it, vi } from 'vitest';
import {
  createPiModelResolver,
  DEFAULT_PI_GATEWAY_MODEL_ID,
} from './pi-model-resolver';

type PiModel = ReturnType<ModelRegistry['getAll']>[number];

function makeRegistry(models: PiModel[] = []) {
  const authStorage = AuthStorage.inMemory();
  const registry = ModelRegistry.inMemory(authStorage);
  vi.spyOn(registry, 'getAll').mockReturnValue(models);
  return registry;
}

const sampleModel: PiModel = {
  id: 'my/model',
  name: 'My Model',
  api: 'anthropic-messages',
  provider: 'example',
  baseUrl: 'https://example.test',
  reasoning: false,
  input: ['text'],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 100_000,
  maxTokens: 4_096,
};

const defaultGatewayModel: PiModel = {
  ...sampleModel,
  id: DEFAULT_PI_GATEWAY_MODEL_ID,
  name: 'Claude Sonnet 4.6',
  provider: 'vercel-ai-gateway',
  baseUrl: 'https://ai-gateway.vercel.sh',
};

describe('createPiModelResolver', () => {
  it('returns matching model by id', () => {
    const resolve = createPiModelResolver(makeRegistry([sampleModel]), {});
    expect(resolve('my/model')).toEqual(sampleModel);
  });

  it('returns matching model by name', () => {
    const resolve = createPiModelResolver(makeRegistry([sampleModel]), {});
    expect(resolve('My Model')).toEqual(sampleModel);
  });

  it('looks up the gateway default when no id and AI_GATEWAY_API_KEY is set', () => {
    const resolve = createPiModelResolver(makeRegistry([defaultGatewayModel]), {
      AI_GATEWAY_API_KEY: 'sk-test',
    });
    expect(resolve(undefined)).toEqual(defaultGatewayModel);
  });

  it('looks up the gateway default when VERCEL_OIDC_TOKEN is set', () => {
    const resolve = createPiModelResolver(makeRegistry([defaultGatewayModel]), {
      VERCEL_OIDC_TOKEN: 'oidc-token',
    });
    expect(resolve(undefined)).toEqual(defaultGatewayModel);
  });

  it('returns undefined for unknown model id', () => {
    const resolve = createPiModelResolver(makeRegistry([sampleModel]), {
      AI_GATEWAY_API_KEY: 'sk-test',
    });
    expect(resolve('unknown')).toBeUndefined();
  });

  it('returns undefined when no model id and no gateway creds', () => {
    const resolve = createPiModelResolver(makeRegistry([sampleModel]), {});
    expect(resolve(undefined)).toBeUndefined();
  });

  it('returns undefined when gateway default id is missing from the registry', () => {
    const resolve = createPiModelResolver(makeRegistry([sampleModel]), {
      AI_GATEWAY_API_KEY: 'sk-test',
    });
    expect(resolve(undefined)).toBeUndefined();
  });
});
