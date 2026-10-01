import { anthropic } from '@ai-sdk/anthropic';
import { Output, isStepCount, streamText } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';
import { weatherTool } from '../../tools/weather-tool';

run(async () => {
  const result = streamText({
    model: anthropic('claude-sonnet-4-5'),
    stopWhen: isStepCount(20),
    output: Output.object({
      schema: z.object({
        elements: z.array(
          z.object({
            location: z.string(),
            temperature: z.number(),
            condition: z.string(),
          }),
        ),
      }),
    }),
    tools: { weather: weatherTool },
    prompt: 'What is the weather in San Francisco, London, Paris, and Berlin?',
  });

  for await (const partialOutput of result.partialOutputStream) {
    console.clear();
    console.log(partialOutput);
  }

  console.dir((await result.request).body, { depth: Infinity });
});
