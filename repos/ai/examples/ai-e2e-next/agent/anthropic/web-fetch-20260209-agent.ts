import { anthropic } from '@ai-sdk/anthropic';
import { ToolLoopAgent, type InferAgentUIMessage } from 'ai';
export const anthropicWebFetch20260209Agent = new ToolLoopAgent({
  model: anthropic('claude-sonnet-4-6'),
  tools: {
    web_fetch: anthropic.tools.webFetch_20260209(),
  },
});

export type AnthropicWebFetch20260209Message = InferAgentUIMessage<
  typeof anthropicWebFetch20260209Agent
>;
