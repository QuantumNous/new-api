import { xai } from '@ai-sdk/xai';
import { ToolLoopAgent } from 'ai';
import { run } from '../../lib/run';

const agent = new ToolLoopAgent({
  model: xai.responses('grok-4-fast-non-reasoning'),
  instructions: 'you are a helpful research assistant',
  tools: {
    web_search: xai.tools.webSearch(),
    x_search: xai.tools.xSearch(),
    code_execution: xai.tools.codeExecution(),
  },
});

run(async () => {
  const result = await agent.stream({
    prompt: 'research prompt caching in llms and explain how it reduces costs',
  });

  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }
});
