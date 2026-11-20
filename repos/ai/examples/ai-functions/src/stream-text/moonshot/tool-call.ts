import { moonshotai } from '@ai-sdk/moonshotai';
import { weatherTool } from '../../tools/weather-tool';
import { isStepCount, streamText, tool } from 'ai';
import { z } from 'zod';
import { printFullStream } from '../../lib/print-full-stream';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: moonshotai('kimi-k3'),
    stopWhen: isStepCount(5),
    tools: {
      currentLocation: tool({
        description: 'Get the current location.',
        inputSchema: z.object({}),
        execute: async () => {
          const locations = ['New York', 'London', 'Paris'];
          return {
            location: locations[Math.floor(Math.random() * locations.length)],
          };
        },
      }),
      weather: weatherTool,
    },
    prompt: 'What is the weather in my current location?',
  });

  await printFullStream({ result });

  console.log('Token usage:', await result.usage);
  console.log('Finish reason:', await result.finishReason);
});
