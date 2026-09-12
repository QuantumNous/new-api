import { openai } from '@ai-sdk/openai';
import { isStepCount, streamText, tool } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: openai('gpt-4o'),
    tools: {
      weather: tool({
        description: 'Get the weather in a location',
        inputSchema: z.object({ location: z.string() }),
        execute: async () => ({
          temperature: 72 + Math.floor(Math.random() * 21) - 10,
        }),
      }),
    },
    stopWhen: isStepCount(5),
    onStepFinish(step) {
      console.log(JSON.stringify(step, null, 2));
    },
    prompt: 'What is the current weather in San Francisco?',
  });

  // consume the text stream
  for await (const textPart of result.textStream) {
  }
});
