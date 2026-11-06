import { runAgentTUI } from '@ai-sdk/tui';
import { xai } from '@ai-sdk/xai';
import { ToolLoopAgent } from 'ai';
import { run } from '../../lib/run';

const agent = new ToolLoopAgent({
  model: xai.responses('grok-4-fast-non-reasoning'),
  instructions:
    'You are a helpful research assistant. Use search and code execution tools when they help.',
  tools: {
    web_search: xai.tools.webSearch(),
    x_search: xai.tools.xSearch(),
    code_execution: xai.tools.codeExecution(),
  },
});

run(async () => {
  await runAgentTUI({
    title: 'XAI Research Agent',
    agent,
    tools: 'auto-collapsed',
  });
});
