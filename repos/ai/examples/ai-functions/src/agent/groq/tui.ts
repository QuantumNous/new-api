import { groq } from '@ai-sdk/groq';
import { runAgentTUI } from '@ai-sdk/tui';
import { ToolLoopAgent } from 'ai';
import { run } from '../../lib/run';

const agent = new ToolLoopAgent({
  model: groq('moonshotai/kimi-k2-instruct-0905'),
  instructions:
    'You are a helpful terminal assistant. Answer clearly and keep responses concise.',
});

run(async () => {
  await runAgentTUI({
    title: 'Groq Agent',
    agent,
  });
});
