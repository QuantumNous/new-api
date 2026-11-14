const DEFAULT_AI_GATEWAY_BASE_URL = 'https://ai-gateway.vercel.sh';

export function getAiGatewayAuthFromEnv({
  env,
}: {
  env: Record<string, string | undefined>;
}): {
  apiKey: string | undefined;
  baseUrl: string;
} {
  return {
    apiKey: env.AI_GATEWAY_API_KEY || env.VERCEL_OIDC_TOKEN || undefined,
    baseUrl: env.AI_GATEWAY_BASE_URL ?? DEFAULT_AI_GATEWAY_BASE_URL,
  };
}
