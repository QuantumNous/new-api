import type { Experimental_RealtimeModelV4ClientEvent as RealtimeClientEvent } from '@ai-sdk/provider';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GatewayAuthenticationError } from './errors';
import {
  GATEWAY_AUTH_SUBPROTOCOL_PREFIX,
  GATEWAY_REALTIME_SUBPROTOCOL,
  getGatewayRealtimeTeamIdOrSlug,
} from './gateway-realtime-auth';
import { GatewayRealtimeModel } from './gateway-realtime-model';
import { createGateway } from './gateway-provider';
import { getVercelOidcToken } from './vercel-environment';

vi.mock('./vercel-environment', () => ({
  getVercelOidcToken: vi.fn(),
  getVercelRequestId: vi.fn(),
}));

const serverOnlyDescribe =
  typeof globalThis.window === 'undefined' ? describe : describe.skip;
const serverOnlyIt = typeof globalThis.window === 'undefined' ? it : it.skip;

const createTestModel = (
  modelId = 'openai/gpt-realtime',
  baseURL = 'https://ai-gateway.vercel.sh/v4/ai',
  token = 'vcst_test-secret',
  teamIdOrSlug?: string,
) =>
  new GatewayRealtimeModel(modelId, {
    provider: 'gateway.realtime',
    baseURL,
    ...(teamIdOrSlug !== undefined && { teamIdOrSlug }),
    createClientSecret: async () => ({ token }),
  });

describe('GatewayRealtimeModel', () => {
  it('exposes the v4 specification, provider, and model id', () => {
    const model = createTestModel();
    expect(model.specificationVersion).toBe('v4');
    expect(model.provider).toBe('gateway.realtime');
    expect(model.modelId).toBe('openai/gpt-realtime');
  });

  describe('doCreateClientSecret', () => {
    it('returns the minted client secret and a wss realtime url with the ai-model-id query', async () => {
      const result = await createTestModel().doCreateClientSecret();
      expect(result.token).toBe('vcst_test-secret');
      expect(result.url).toBe(
        'wss://ai-gateway.vercel.sh/v4/ai/realtime-model?ai-model-id=openai%2Fgpt-realtime',
      );
    });

    it('upgrades an http base url to ws (local development)', async () => {
      const result = await createTestModel(
        'openai/gpt-realtime',
        'http://localhost:3000/v4/ai',
      ).doCreateClientSecret();
      expect(result.url).toBe(
        'ws://localhost:3000/v4/ai/realtime-model?ai-model-id=openai%2Fgpt-realtime',
      );
    });

    it('passes the model id through verbatim (the gateway owns qualification)', async () => {
      const result =
        await createTestModel('gpt-realtime-2').doCreateClientSecret();
      // No client-side `openai/` prefixing — mirrors the non-realtime routes.
      expect(result.url).toBe(
        'wss://ai-gateway.vercel.sh/v4/ai/realtime-model?ai-model-id=gpt-realtime-2',
      );
    });

    it('forwards modelId + expiresAfterSeconds to the mint hook and surfaces expiresAt', async () => {
      const createClientSecret = vi.fn(async () => ({
        token: 'vcst_minted',
        expiresAt: 1_700_000_060,
      }));
      const model = new GatewayRealtimeModel('openai/gpt-realtime-2', {
        provider: 'gateway.realtime',
        baseURL: 'https://ai-gateway.vercel.sh/v4/ai',
        createClientSecret,
      });

      const result = await model.doCreateClientSecret({
        expiresAfterSeconds: 120,
      });

      expect(createClientSecret).toHaveBeenCalledWith({
        modelId: 'openai/gpt-realtime-2',
        expiresAfterSeconds: 120,
      });
      expect(result.token).toBe('vcst_minted');
      expect(result.expiresAt).toBe(1_700_000_060);
    });

    it('omits expiresAt when the mint hook does not return one', async () => {
      const result = await createTestModel().doCreateClientSecret();
      expect('expiresAt' in result).toBe(false);
    });
  });

  describe('getWebSocketConfig', () => {
    it('smuggles the bearer token through the subprotocol (browser has no header channel)', () => {
      const config = createTestModel().getWebSocketConfig({
        token: 'vck_test-token',
        url: 'wss://ai-gateway.vercel.sh/v4/ai/realtime-model?ai-model-id=openai%2Fgpt-realtime',
      });
      expect(config.url).toBe(
        'wss://ai-gateway.vercel.sh/v4/ai/realtime-model?ai-model-id=openai%2Fgpt-realtime',
      );
      expect(config.protocols).toEqual([
        GATEWAY_REALTIME_SUBPROTOCOL,
        `${GATEWAY_AUTH_SUBPROTOCOL_PREFIX}vck_test-token`,
      ]);
    });

    it('smuggles optional team scoping through the subprotocol', () => {
      const config = createTestModel(
        'openai/gpt-realtime',
        'https://ai-gateway.vercel.sh/v4/ai',
        'vck_test-token',
        'team_123',
      ).getWebSocketConfig({
        token: 'vck_test-token',
        url: 'wss://ai-gateway.vercel.sh/v4/ai/realtime-model?ai-model-id=openai%2Fgpt-realtime',
      });

      expect(getGatewayRealtimeTeamIdOrSlug(config.protocols?.join(', '))).toBe(
        'team_123',
      );
    });
  });

  describe('normalized identity codec', () => {
    it('passes server events through unchanged', () => {
      const event = { type: 'response-created', responseId: 'resp_1', raw: {} };
      expect(createTestModel().parseServerEvent(event)).toBe(event);
    });

    it('passes client events through unchanged', () => {
      const event = { type: 'response-create' } as const;
      expect(createTestModel().serializeClientEvent(event)).toBe(event);
    });

    it('passes session config through unchanged', () => {
      const config = { instructions: 'be concise', voice: 'alloy' };
      expect(createTestModel().buildSessionConfig(config)).toBe(config);
    });

    it('passes session-update provider options through unchanged', () => {
      // "Support all the things": gateway provider options (tags/user/byok/...)
      // ride session.update exactly as they ride the request body on the
      // non-realtime routes. The identity codec must not strip them.
      const event = {
        type: 'session-update',
        config: {
          instructions: 'be concise',
          providerOptions: {
            gateway: { tags: ['demo'], user: 'user-1' },
          },
        },
      } satisfies RealtimeClientEvent;
      expect(createTestModel().serializeClientEvent(event)).toBe(event);
    });
  });
});

describe('gateway.experimental_realtime', () => {
  const gateway = createGateway({ apiKey: 'vck_test-token' });

  serverOnlyIt('creates a realtime model from a model id', () => {
    const model = gateway.experimental_realtime('openai/gpt-realtime');
    expect(model.specificationVersion).toBe('v4');
    expect(model.modelId).toBe('openai/gpt-realtime');
    expect(model.provider).toBe('gateway.realtime');
  });

  serverOnlyIt(
    'mints a vcst_ client secret via /v1/realtime/client-secrets and returns it with the wss url',
    async () => {
      let capturedMintUrl = '';
      const fetch = vi.fn(
        async (input: string | URL | Request, _init?: RequestInit) => {
          const url = input instanceof Request ? input.url : input.toString();
          capturedMintUrl = url;
          return new Response(
            JSON.stringify({ token: 'vcst_minted', expiresAt: 1_700_000_060 }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        },
      );
      const mintGateway = createGateway({ apiKey: 'vck_test-token', fetch });

      const result = await mintGateway.experimental_realtime.getToken({
        model: 'openai/gpt-realtime',
        expiresAfterSeconds: 120,
      });

      // Minted token (not the raw key), and the mint hit the v1 route on the
      // gateway origin — not the realtime baseURL path (/v4/ai).
      expect(result.token).toBe('vcst_minted');
      expect(result.expiresAt).toBe(1_700_000_060);
      expect(result.url).toBe(
        'wss://ai-gateway.vercel.sh/v4/ai/realtime-model?ai-model-id=openai%2Fgpt-realtime',
      );
      expect(capturedMintUrl).toBe(
        'https://ai-gateway.vercel.sh/v1/realtime/client-secrets',
      );

      // The request body forwarded the model and the TTL. `routeKind` is
      // omitted for realtime mints (the gateway default) so older gateway
      // deployments keep accepting them.
      const init = fetch.mock.calls[0]?.[1] as RequestInit;
      const sentBody = JSON.parse(init.body as string);
      expect(sentBody).toMatchObject({
        model: 'openai/gpt-realtime',
        expiresIn: 120,
      });
      expect('routeKind' in sentBody).toBe(false);
      // Authenticated with the long-lived key.
      const sentHeaders = new Headers(init.headers);
      expect(sentHeaders.get('authorization')).toBe('Bearer vck_test-token');
    },
  );

  serverOnlyIt(
    'tolerates a null expiresAt from the mint endpoint and omits it from the result',
    async () => {
      const fetch = vi.fn(
        async () =>
          new Response(
            JSON.stringify({ token: 'vcst_minted', expiresAt: null }),
            {
              status: 200,
              headers: { 'content-type': 'application/json' },
            },
          ),
      );
      const mintGateway = createGateway({ apiKey: 'vck_test-token', fetch });

      const result = await mintGateway.experimental_realtime.getToken({
        model: 'openai/gpt-realtime',
      });

      expect(result.token).toBe('vcst_minted');
      expect('expiresAt' in result).toBe(false);
    },
  );

  serverOnlyIt(
    'carries teamIdOrSlug through realtime WebSocket protocols',
    () => {
      const scopedGateway = createGateway({
        apiKey: 'vck_test-token',
        teamIdOrSlug: 'my-team',
      });
      const model = scopedGateway.experimental_realtime('openai/gpt-realtime');
      const config = model.getWebSocketConfig({
        token: 'vcst_test-secret',
        url: 'wss://ai-gateway.vercel.sh/v4/ai/realtime-model?ai-model-id=openai%2Fgpt-realtime',
      });

      expect(getGatewayRealtimeTeamIdOrSlug(config.protocols?.join(', '))).toBe(
        'my-team',
      );
    },
  );

  it('allows building the realtime codec model in browsers (no minting)', () => {
    // Building the model is just the event codec + WS-config helper, which the
    // browser needs to drive the transport with a server-minted token. No
    // credential is touched here, so it must not throw.
    withBrowserGlobal(() => {
      const model = gateway.experimental_realtime('openai/gpt-realtime');
      expect(model.specificationVersion).toBe('v4');
      expect(
        model.getWebSocketConfig({ token: 'vcst_x', url: 'wss://x/y' }).url,
      ).toBe('wss://x/y');
    });
  });

  it('rejects minting (getToken) in browsers — the credential must stay server-side', async () => {
    await withBrowserGlobal(async () => {
      await expect(
        gateway.experimental_realtime.getToken({
          model: 'openai/gpt-realtime',
        }),
      ).rejects.toThrow(/must be minted server-side/);
    });
  });
});

function withBrowserGlobal<T>(callback: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {},
  });

  try {
    return callback();
  } finally {
    if (descriptor) {
      Object.defineProperty(globalThis, 'window', descriptor);
    } else {
      Reflect.deleteProperty(globalThis, 'window');
    }
  }
}

serverOnlyDescribe('gateway.experimental_realtime auth errors', () => {
  let previousApiKey: string | undefined;

  beforeEach(() => {
    previousApiKey = process.env.AI_GATEWAY_API_KEY;
    Reflect.deleteProperty(process.env, 'AI_GATEWAY_API_KEY');
    vi.mocked(getVercelOidcToken).mockRejectedValue(
      new Error('no oidc token available'),
    );
  });

  afterEach(() => {
    if (previousApiKey !== undefined) {
      process.env.AI_GATEWAY_API_KEY = previousApiKey;
    }
    vi.clearAllMocks();
  });

  it('wraps getToken auth failures in a GatewayAuthenticationError', async () => {
    // No API key and no OIDC token: the realtime auth path must surface the
    // same GatewayAuthenticationError the other gateway models throw.
    const gateway = createGateway({});
    await expect(
      gateway.experimental_realtime.getToken({
        model: 'openai/gpt-realtime-2',
      }),
    ).rejects.toBeInstanceOf(GatewayAuthenticationError);
  });
});
