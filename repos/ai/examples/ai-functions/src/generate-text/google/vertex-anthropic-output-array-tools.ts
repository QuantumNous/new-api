import { vertexAnthropic } from '@ai-sdk/google-vertex/anthropic';
import { generateText, Output, isStepCount } from 'ai';
import { z } from 'zod';
import { print } from '../../lib/print';
import { run } from '../../lib/run';
import { weatherTool } from '../../tools/weather-tool';

run(async () => {
  const result = await generateText({
    model: vertexAnthropic('claude-3-5-sonnet-v2@20241022'),
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

  print('Output:', result.output);
});
