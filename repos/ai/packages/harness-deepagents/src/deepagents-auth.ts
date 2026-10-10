import { getAiGatewayAuthFromEnv } from '@ai-sdk/harness/utils';

export type DeepAgentsAuthOptions = {
  readonly anthropic?: {
    readonly apiKey?: string;
    readonly authToken?: string;
    readonly baseUrl?: string;
  };
  readonly gateway?: {
    readonly apiKey?: string;
    readonly baseUrl?: string;
  };
};

// DeepAgents always drives the Anthropic client. Non-Anthropic models reach it
// through AI Gateway's Anthropic-compatible endpoint, which translates to any
// model (Gemini, OpenAI, etc.), tool calls included.
export function resolveDeepAgentsEnv({
  auth,
  processEnv = process.env,
}: {
  auth?: DeepAgentsAuthOptions;
  processEnv?: Record<string, string | undefined>;
}): Record<string, string> {
  if (auth?.anthropic) {
    return pickAnthropic({ explicit: auth.anthropic, processEnv });
  }

  const gatewayAuthFromEnv = getAiGatewayAuthFromEnv({ env: processEnv });
  if (auth?.gateway) {
    return pickGateway({ explicit: auth.gateway, gatewayAuthFromEnv });
  }
  if (gatewayAuthFromEnv.apiKey) {
    return pickGateway({ explicit: {}, gatewayAuthFromEnv });
  }

  return pickAnthropic({ processEnv });
}

function pickAnthropic({
  explicit,
  processEnv,
}: {
  explicit?: NonNullable<DeepAgentsAuthOptions['anthropic']>;
  processEnv: Record<string, string | undefined>;
}): Record<string, string> {
  const env: Record<string, string> = {};
  const apiKey = explicit?.apiKey ?? processEnv.ANTHROPIC_API_KEY;
  if (apiKey) env.ANTHROPIC_API_KEY = apiKey;
  const authToken = explicit?.authToken ?? processEnv.ANTHROPIC_AUTH_TOKEN;
  if (authToken) env.ANTHROPIC_AUTH_TOKEN = authToken;
  const baseUrl = explicit?.baseUrl ?? processEnv.ANTHROPIC_BASE_URL;
  if (baseUrl) env.ANTHROPIC_BASE_URL = baseUrl;
  return env;
}

function pickGateway({
  explicit,
  gatewayAuthFromEnv,
}: {
  explicit: NonNullable<DeepAgentsAuthOptions['gateway']>;
  gatewayAuthFromEnv: ReturnType<typeof getAiGatewayAuthFromEnv>;
}): Record<string, string> {
  const apiKey = explicit.apiKey ?? gatewayAuthFromEnv.apiKey;
  // The Anthropic SDK appends `/v1/messages`, so the gateway base stays at its root.
  const baseUrl = (explicit.baseUrl ?? gatewayAuthFromEnv.baseUrl).replace(
    /\/+$/,
    '',
  );
  const env: Record<string, string> = {};
  if (apiKey) {
    env.AI_GATEWAY_API_KEY = apiKey;
    env.ANTHROPIC_API_KEY = apiKey;
  }
  env.ANTHROPIC_BASE_URL = baseUrl;
  return env;
}
