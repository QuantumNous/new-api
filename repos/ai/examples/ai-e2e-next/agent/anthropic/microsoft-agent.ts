// anthropic-microsoft-agent.ts
import { createAnthropic } from '@ai-sdk/anthropic';
import { ToolLoopAgent, type InferAgentUIMessage } from 'ai';
export function createAnthropicMicrosoftAgent() {
  const resourceName = process.env.ANTHROPIC_MICROSOFT_RESOURCE_NAME;
  const apiKey = process.env.ANTHROPIC_MICROSOFT_API_KEY;

  if (!resourceName || !apiKey) {
    throw new Error('undefined resource or key.');
  }

  const anthropic = createAnthropic({
    baseURL: `https://${resourceName}.services.ai.azure.com/anthropic/v1/`,
    apiKey,
  });

  return new ToolLoopAgent({
    model: anthropic('claude-sonnet-4-5'),
    tools: {
      code_execution: anthropic.tools.codeExecution_20250825(),
      web_search: anthropic.tools.webSearch_20250305({
        maxUses: 3,
        userLocation: {
          type: 'approximate',
          city: 'New York',
          country: 'US',
          timezone: 'America/New_York',
        },
      }),
      web_fetch: anthropic.tools.webFetch_20250910(),
    },
  });
}

export type AnthropicMicrosoftAgent = ReturnType<
  typeof createAnthropicMicrosoftAgent
>;

export type AnthropicMicrosoftMessage =
  InferAgentUIMessage<AnthropicMicrosoftAgent>;
