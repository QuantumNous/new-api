import type {
  AuthStorage,
  ModelRegistry,
} from '@earendil-works/pi-coding-agent';
import { getAiGatewayAuthFromEnv } from '@ai-sdk/harness/utils';
import { VERSION } from './version';

type ProviderConfigInput = Parameters<ModelRegistry['registerProvider']>[1];

/**
 * Pi auth options. Exactly one of `gateway` or `customEnv` is honoured
 * (precedence: explicit `customEnv`, then explicit `gateway`, then ambient
 * gateway from `process.env`). To use multiple providers, use `customEnv`
 * with the standard `<PREFIX>_API_KEY` / `<PREFIX>_BASE_URL` pattern.
 */
export type PiAuthOptions = {
  readonly gateway?: {
    readonly apiKey?: string;
    readonly baseUrl?: string;
  };
  /**
   * Resolved environment-variable pairs of the form `<PREFIX>_API_KEY` and
   * (optionally) `<PREFIX>_BASE_URL`. Special-cased prefixes:
   *  - `AI_GATEWAY` → registers `vercel-ai-gateway`
   *  - `OPENAI`     → registers `openai`
   *  - `ANTHROPIC`  → registers `anthropic` (`ANTHROPIC_AUTH_TOKEN` adds a
   *                   bearer auth header)
   * Any other `<PREFIX>_API_KEY` with a matching `<PREFIX>_BASE_URL` is
   * registered as the lowercased, dash-separated prefix.
   */
  readonly customEnv?: Record<string, string>;
};

const DEFAULT_GATEWAY_BASE_URL = 'https://ai-gateway.vercel.sh';
const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_ANTHROPIC_BASE_URL = 'https://api.anthropic.com';
const HARNESS_CLIENT_APP = `ai-sdk/harness-pi/${VERSION}`;

function createGatewayProviderConfig({
  apiKey,
  baseUrl,
  clientApp,
}: {
  apiKey: string;
  baseUrl: string;
  clientApp: string;
}): ProviderConfigInput {
  return {
    apiKey,
    baseUrl,
    authHeader: true,
    headers: {
      'User-Agent': clientApp,
      'x-client-app': clientApp,
    },
  };
}

function register(
  registries: { authStorage: AuthStorage; modelRegistry: ModelRegistry },
  provider: string,
  apiKey: string,
  config: ProviderConfigInput,
): void {
  registries.authStorage.setRuntimeApiKey(provider, apiKey);
  registries.modelRegistry.registerProvider(provider, config);
}

function hasConfiguredValue(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.length > 0;
  if (typeof value !== 'object') return true;
  return Object.values(value).some(hasConfiguredValue);
}

export function resolvePiEnv({
  options,
  env,
  registries,
  clientApp = HARNESS_CLIENT_APP,
}: {
  options: PiAuthOptions | undefined;
  env: NodeJS.ProcessEnv;
  registries: { authStorage: AuthStorage; modelRegistry: ModelRegistry };
  clientApp?: string;
}): Record<string, string> {
  const customEnvConfigured = hasConfiguredValue(options?.customEnv);
  if (customEnvConfigured) {
    return applyCustomEnv({
      customEnv: options!.customEnv ?? {},
      registries,
      clientApp,
    });
  }

  const gatewayConfigured = hasConfiguredValue(options?.gateway);
  const gatewayAuthFromEnv = getAiGatewayAuthFromEnv({ env });
  if (gatewayConfigured) {
    const apiKey = options!.gateway?.apiKey ?? gatewayAuthFromEnv.apiKey;
    const baseUrl = options!.gateway?.baseUrl ?? gatewayAuthFromEnv.baseUrl;
    if (apiKey) {
      register(
        registries,
        'vercel-ai-gateway',
        apiKey,
        createGatewayProviderConfig({
          apiKey,
          baseUrl,
          clientApp,
        }),
      );
      return { AI_GATEWAY_API_KEY: apiKey, AI_GATEWAY_BASE_URL: baseUrl };
    }
    return {};
  }

  // Ambient gateway fallback.
  if (gatewayAuthFromEnv.apiKey) {
    register(
      registries,
      'vercel-ai-gateway',
      gatewayAuthFromEnv.apiKey,
      createGatewayProviderConfig({
        apiKey: gatewayAuthFromEnv.apiKey,
        baseUrl: gatewayAuthFromEnv.baseUrl,
        clientApp,
      }),
    );
    return {
      AI_GATEWAY_API_KEY: gatewayAuthFromEnv.apiKey,
      AI_GATEWAY_BASE_URL: gatewayAuthFromEnv.baseUrl,
    };
  }

  return {};
}

function applyCustomEnv({
  customEnv,
  registries,
  clientApp,
}: {
  customEnv: Record<string, string>;
  registries: { authStorage: AuthStorage; modelRegistry: ModelRegistry };
  clientApp: string;
}): Record<string, string> {
  const out: Record<string, string> = {};

  const gatewayKey = customEnv.AI_GATEWAY_API_KEY;
  if (gatewayKey) {
    const baseUrl = customEnv.AI_GATEWAY_BASE_URL ?? DEFAULT_GATEWAY_BASE_URL;
    register(
      registries,
      'vercel-ai-gateway',
      gatewayKey,
      createGatewayProviderConfig({
        apiKey: gatewayKey,
        baseUrl,
        clientApp,
      }),
    );
    out.AI_GATEWAY_API_KEY = gatewayKey;
    out.AI_GATEWAY_BASE_URL = baseUrl;
  }

  if (customEnv.OPENAI_API_KEY) {
    const baseUrl = customEnv.OPENAI_BASE_URL ?? DEFAULT_OPENAI_BASE_URL;
    register(registries, 'openai', customEnv.OPENAI_API_KEY, {
      apiKey: customEnv.OPENAI_API_KEY,
      baseUrl,
      authHeader: true,
    });
  }

  if (customEnv.ANTHROPIC_API_KEY) {
    const baseUrl = customEnv.ANTHROPIC_BASE_URL ?? DEFAULT_ANTHROPIC_BASE_URL;
    register(registries, 'anthropic', customEnv.ANTHROPIC_API_KEY, {
      apiKey: customEnv.ANTHROPIC_API_KEY,
      baseUrl,
      ...(customEnv.ANTHROPIC_AUTH_TOKEN
        ? {
            headers: {
              authorization: `Bearer ${customEnv.ANTHROPIC_AUTH_TOKEN}`,
            },
          }
        : {}),
    });
  }

  for (const [name, apiKey] of Object.entries(customEnv)) {
    if (!name.endsWith('_API_KEY') || !apiKey) {
      continue;
    }
    const prefix = name.slice(0, -'_API_KEY'.length);
    if (
      prefix === 'AI_GATEWAY' ||
      prefix === 'OPENAI' ||
      prefix === 'ANTHROPIC'
    ) {
      continue;
    }
    const provider = prefix.toLowerCase().replace(/_/g, '-');
    const baseUrl = customEnv[`${prefix}_BASE_URL`];
    if (!baseUrl) {
      continue;
    }
    register(registries, provider, apiKey, {
      apiKey,
      baseUrl,
      authHeader: true,
    });
  }

  return out;
}
