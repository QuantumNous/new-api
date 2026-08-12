import { openai } from '@ai-sdk/openai';
import { ToolLoopAgent, tool } from 'ai';
import { run } from '../../lib/run';
import { z } from 'zod';

const agent = new ToolLoopAgent({
  model: openai('gpt-5'),
  instructions: 'You are a helpful that answers questions about the weather.',
  tools: {
    weather: tool({
      description: 'Get the weather in a location',
      inputSchema: z.object({
        location: z.string().describe('The location to get the weather for'),
      }),
      execute: ({ location }) => ({
        location,
        temperature: 72 + Math.floor(Math.random() * 21) - 10,
      }),
    }),
  },
});

run(async () => {
  const result = await agent.stream({
    prompt: 'What is the weather in Tokyo?',
  });

  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }
});
