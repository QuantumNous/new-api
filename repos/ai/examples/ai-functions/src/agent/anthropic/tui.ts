import { anthropic } from '@ai-sdk/anthropic';
import { runAgentTUI } from '@ai-sdk/tui';
import { ToolLoopAgent } from 'ai';
import { run } from '../../lib/run';
import { weatherTool } from '../../tools/weather-tool';

const agent = new ToolLoopAgent({
  model: anthropic('claude-haiku-4-5'),
  instructions:
    'You are a helpful terminal assistant. Answer in markdown and use tools when they help.',
  tools: {
    weather: weatherTool,
  },
});

run(async () => {
  await runAgentTUI({
    title: 'Anthropic Agent',
    agent,
    tools: 'auto-collapsed',
  });
});
