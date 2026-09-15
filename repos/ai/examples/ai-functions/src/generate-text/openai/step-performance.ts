import { openai } from '@ai-sdk/openai';
import { generateText, isStepCount, tool } from 'ai';
import { z } from 'zod';
import { print } from '../../lib/print';
import { run } from '../../lib/run';
import { weatherTool } from '../../tools/weather-tool';

run(async () => {
  const result = await generateText({
    model: openai('gpt-5-nano'),
    stopWhen: isStepCount(3),
    maxRetries: 0,
    tools: {
      currentLocation: tool({
        description: 'Get the current location.',
        inputSchema: z.object({}),
        execute: async () => ({ location: 'San Francisco' }),
      }),
      weather: weatherTool,
    },
    prompt: 'What is the weather in my current location?',
  });

  print('Text:', result.text);
  print(
    'Step performance:',
    result.steps.map(step => step.performance),
  );
  print('Final step performance:', result.finalStep.performance);
  print('Total usage:', result.usage);
});
