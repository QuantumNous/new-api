import {
  openai,
  type OpenAILanguageModelResponsesOptions,
} from '@ai-sdk/openai';
import { Output, isStepCount, streamText } from 'ai';
import { z } from 'zod';
import { print } from '../../lib/print';
import { run } from '../../lib/run';
import { weatherTool } from '../../tools/weather-tool';

run(async () => {
  const result = streamText({
    model: openai('gpt-4o-mini'),
    providerOptions: {
      openai: {
        strictJsonSchema: true,
      } satisfies OpenAILanguageModelResponsesOptions,
    },
    tools: {
      weather: weatherTool,
    },
    stopWhen: isStepCount(5),
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
    prompt: 'What is the weather in San Francisco, London, Paris, and Berlin?',
  });

  for await (const partialOutput of result.partialOutputStream) {
    console.clear();
    console.log(partialOutput);
  }

  print('Output:', await result.output);
});
