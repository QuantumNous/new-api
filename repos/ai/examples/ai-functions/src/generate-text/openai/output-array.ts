import {
  openai,
  type OpenAILanguageModelResponsesOptions,
} from '@ai-sdk/openai';
import { generateText, Output, isStepCount } from 'ai';
import { z } from 'zod';
import { print } from '../../lib/print';
import { run } from '../../lib/run';
import { weatherTool } from '../../tools/weather-tool';

run(async () => {
  const result = await generateText({
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

  print('Output:', result.output);
  print('Request:', result.request.body);
});
