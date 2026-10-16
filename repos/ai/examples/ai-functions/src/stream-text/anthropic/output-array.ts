import { anthropic } from '@ai-sdk/anthropic';
import { Output, isStepCount, streamText } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';
import { weatherTool } from '../../tools/weather-tool';

run(async () => {
  const { partialOutputStream } = streamText({
    model: anthropic('claude-haiku-4-5'),
    stopWhen: isStepCount(20),
    output: Output.array({
      element: z.object({
        location: z.string(),
        temperature: z.number(),
        condition: z.string(),
      }),
    }),
    tools: { weather: weatherTool },
    prompt: 'What is the weather in San Francisco, London, Paris, and Berlin?',
  });

  for await (const partialOutput of partialOutputStream) {
    console.clear();
    console.log(partialOutput);
  }
});
