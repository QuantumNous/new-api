import {
  openai,
  type OpenAILanguageModelResponsesOptions,
} from '@ai-sdk/openai';
import { Output, isStepCount, streamText } from 'ai';
import { z } from 'zod';
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
    output: Output.array({
      element: z.object({
        location: z.string(),
        temperature: z.number(),
        condition: z.string(),
      }),
    }),
    prompt: 'What is the weather in San Francisco, London, Paris, and Berlin?',
  });

  // elementStream streams individual completed elements one at a time,
  // unlike partialOutputStream which streams the entire partial array
  for await (const element of result.elementStream) {
    console.log('New element:', element);
  }

  console.log('Usage:', await result.usage);
});
