import { openai } from '@ai-sdk/openai';
import { generateText, isStepCount, tool } from 'ai';
import { z } from 'zod';
import { weatherTool } from '../../tools/weather-tool';
import { run } from '../../lib/run';

run(async () => {
  const { text } = await generateText({
    model: openai('gpt-4o'),
    tools: {
      weather: weatherTool,
      cityAttractions: tool({
        inputSchema: z.object({ city: z.string() }),
      }),
    },
    activeTools: [], // disable all tools
    stopWhen: isStepCount(5),
    prompt:
      'What is the weather in San Francisco and what attractions should I visit?',
  });

  console.log(text);
});
