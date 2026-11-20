import { openai } from '@ai-sdk/openai';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';
import { saveRawChunks } from '../../lib/save-raw-chunks';
import { weatherTool } from '../../tools/weather-tool';

run(async () => {
  const result = streamText({
    model: openai.responses('zai-org/glm-4.7-flash'),
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
    toolChoice: 'required',
    prompt: 'What is the weather in my current location and in Rome?',
    include: {
      rawChunks: true,
    },
  });

  await saveRawChunks({
    result,
    filename: 'openai-responses-function-tool-lmstudio.1',
  });
});
