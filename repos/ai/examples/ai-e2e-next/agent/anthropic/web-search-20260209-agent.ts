import { anthropic } from '@ai-sdk/anthropic';
import { ToolLoopAgent, type InferAgentUIMessage } from 'ai';
export const anthropicWebSearch20260209Agent = new ToolLoopAgent({
  model: anthropic('claude-sonnet-4-6'),
  tools: {
    web_search: anthropic.tools.webSearch_20260209({
      maxUses: 3,
      userLocation: {
        type: 'approximate',
        city: 'New York',
        country: 'US',
        timezone: 'America/New_York',
      },
    }),
  },
});

export type AnthropicWebSearch20260209Message = InferAgentUIMessage<
  typeof anthropicWebSearch20260209Agent
>;
