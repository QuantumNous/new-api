import { openai } from '@ai-sdk/openai';
import { runAgentTUI } from '@ai-sdk/tui';
import { ToolLoopAgent } from 'ai';
import { run } from '../../lib/run';
import { weatherTool } from '../../tools/weather-tool';

const agent = new ToolLoopAgent({
  model: openai('gpt-5.6'),
  instructions:
    'You are a helpful terminal assistant. Answer in markdown and use tools when they help.',
  tools: {
    weather: weatherTool,
  },
});

run(async () => {
  await runAgentTUI({
    title: 'OpenAI Agent',
    agent,
    tools: 'auto-collapsed',
    reasoning: 'auto-collapsed',
  });
});
