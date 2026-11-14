import { anthropic } from '@ai-sdk/anthropic';
import { ToolLoopAgent, type InferAgentUIMessage } from 'ai';
export const anthropicWebFetchAgent = new ToolLoopAgent({
  model: anthropic('claude-sonnet-4-5'),
  tools: {
    web_fetch: anthropic.tools.webFetch_20250910(),
  },
  reasoning: 'medium',
  telemetry: {
    functionId: 'anthropic-web-fetch-agent',
  },
});

export type AnthropicWebFetchMessage = InferAgentUIMessage<
  typeof anthropicWebFetchAgent
>;
