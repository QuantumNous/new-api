import { xai } from '@ai-sdk/xai';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const { stream } = streamText({
    model: xai.responses('grok-4-fast-non-reasoning'),
    tools: {
      web_search: xai.tools.webSearch(),
      x_search: xai.tools.xSearch(),
      code_execution: xai.tools.codeExecution(),
    },
    prompt: 'Can you research about Vercel AI Gateway?',
  });

  let toolCallCount = 0;

  for await (const event of stream) {
    if (event.type === 'tool-call') {
      toolCallCount++;
      console.log(
        `\n[Tool Call ${toolCallCount}] ${event.toolName}${event.providerExecuted ? ' (server-side)' : ' (client)'}`,
      );
    } else if (event.type === 'text-delta') {
      process.stdout.write(event.text);
    } else if (event.type === 'source' && event.sourceType === 'url') {
      console.log(`\n[Citation] ${event.url}`);
    }
  }

  console.log('\n');
});
