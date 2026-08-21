import { anthropic } from '@ai-sdk/anthropic';
import { ToolLoopAgent, type InferAgentUIMessage } from 'ai';

export const anthropicAdvisor20260301Agent = new ToolLoopAgent({
  model: anthropic('claude-sonnet-4-6'),
  instructions: [
    'You have access to an `advisor` tool backed by a stronger reviewer model.',
    'Call advisor BEFORE substantive work and again before declaring done.',
    'The advisor should respond in under 100 words and use enumerated steps,',
    'not explanations.',
  ].join('\n'),
  tools: {
    advisor: anthropic.tools.advisor_20260301({
      model: 'claude-opus-4-7',
      maxUses: 3,
    }),
  },
});

export type AnthropicAdvisor20260301Message = InferAgentUIMessage<
  typeof anthropicAdvisor20260301Agent
>;
