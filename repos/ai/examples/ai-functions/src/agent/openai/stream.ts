import { openai } from '@ai-sdk/openai';
import { ToolLoopAgent } from 'ai';
import { run } from '../../lib/run';

const agent = new ToolLoopAgent({
  model: openai('gpt-5'),
  instructions: 'You are a helpful assistant.',
});

run(async () => {
  const result = await agent.stream({
    prompt: 'Invent a new holiday and describe its traditions.',
  });

  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }
});
