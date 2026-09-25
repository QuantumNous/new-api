import type { GoogleLanguageModelInteractionsOptions } from '@ai-sdk/google';

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

type ManagedAgentBaseEnvironment =
  | { env_id: string }
  | Exclude<
      NonNullable<GoogleLanguageModelInteractionsOptions['environment']>,
      string
    >;

function getApiKey(apiKey?: string): string {
  const key = apiKey ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) {
    throw new Error(
      'Missing API key. Set GOOGLE_GENERATIVE_AI_API_KEY or pass apiKey explicitly.',
    );
  }
  return key;
}

export type CreateGoogleManagedAgentParams = {
  name: string;
  baseAgent?: string;
  instructions?: string;
  baseEnvironment?: ManagedAgentBaseEnvironment;
  apiKey?: string;
};

export async function createGoogleManagedAgent({
  name,
  baseAgent = 'antigravity-preview-05-2026',
  instructions,
  baseEnvironment,
  apiKey,
}: CreateGoogleManagedAgentParams): Promise<{ name: string }> {
  const body: Record<string, unknown> = {
    name,
    base_agent: baseAgent,
  };
  if (instructions != null) body.instructions = instructions;
  if (baseEnvironment != null) body.base_environment = baseEnvironment;

  const response = await fetch(`${BASE_URL}/agents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': getApiKey(apiKey),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Failed to create managed agent "${name}": ${response.status} ${text}`,
    );
  }

  return { name };
}

export async function deleteGoogleManagedAgent({
  name,
  apiKey,
}: {
  name: string;
  apiKey?: string;
}): Promise<void> {
  const response = await fetch(`${BASE_URL}/agents/${name}`, {
    method: 'DELETE',
    headers: {
      'x-goog-api-key': getApiKey(apiKey),
    },
  });

  if (response.status === 404) return;

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Failed to delete managed agent "${name}": ${response.status} ${text}`,
    );
  }
}
