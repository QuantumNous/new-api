import { openai } from '@ai-sdk/openai';
import { weatherTool } from '../../tools/weather-tool';
import { isStepCount, streamText, dynamicTool, type ToolSet } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

function dynamicTools(): ToolSet {
  return {
    currentLocation: dynamicTool({
      description: 'Get the current location.',
      inputSchema: z.object({}),
      execute: async () => {
        const locations = ['New York', 'London', 'Paris'];
        return {
          location: locations[Math.floor(Math.random() * locations.length)],
        };
      },
    }),
  };
}

run(async () => {
  const result = streamText({
    model: openai('gpt-4o'),
    stopWhen: isStepCount(5),
    tools: {
      ...dynamicTools(),
      weather: weatherTool,
    },
    prompt: 'What is the weather in my current location?',
  });

  for await (const chunk of result.stream) {
    switch (chunk.type) {
      case 'text-delta': {
        process.stdout.write(chunk.text);
        break;
      }

      case 'tool-call': {
        if (chunk.dynamic) {
          console.log('DYNAMIC CALL', JSON.stringify(chunk, null, 2));
          continue;
        }

        switch (chunk.toolName) {
          case 'weather': {
            console.log('STATIC CALL', JSON.stringify(chunk, null, 2));
            chunk.input.location; // string
            break;
          }
        }

        break;
      }

      case 'tool-result': {
        if (chunk.dynamic) {
          console.log('DYNAMIC RESULT', JSON.stringify(chunk, null, 2));
          continue;
        }

        switch (chunk.toolName) {
          case 'weather': {
            console.log('STATIC RESULT', JSON.stringify(chunk, null, 2));
            chunk.input.location; // string
            chunk.output.location; // string
            chunk.output.temperature; // number
            break;
          }
        }

        break;
      }

      case 'error':
        console.error('Error:', chunk.error);
        break;
    }
  }
});
