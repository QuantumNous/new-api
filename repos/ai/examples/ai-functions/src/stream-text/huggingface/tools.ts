import { huggingFace } from '@ai-sdk/huggingface';
import { isStepCount, streamText, tool } from 'ai';
import { z } from 'zod/v4';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: huggingFace.responses('deepseek-ai/DeepSeek-V3-0324'),
    stopWhen: isStepCount(5),
    toolChoice: 'required',
    tools: {
      currentLocation: tool({
        description: 'Get the current location.',
        inputSchema: z.object({}),
        execute: async () => {
          const locations = ['New York', 'London', 'Paris', 'Tokyo', 'Sydney'];
          return {
            location: locations[Math.floor(Math.random() * locations.length)],
          };
        },
      }),
      getTime: tool({
        description: 'Get the current time in a specific timezone',
        inputSchema: z.object({
          timezone: z.string().describe('The timezone, e.g. America/New_York'),
        }),
        execute: async ({ timezone }) => {
          const now = new Date();
          return {
            timezone,
            time: now.toLocaleString('en-US', { timeZone: timezone }),
            timestamp: now.getTime(),
          };
        },
      }),
      weather: tool({
        description: 'Get the weather in a location',
        inputSchema: z.object({
          location: z.string().describe('The location to get the weather for'),
        }),
        execute: async ({ location }) => ({
          location,
          temperature: 72 + Math.floor(Math.random() * 21) - 10,
          condition: ['sunny', 'cloudy', 'rainy', 'snowy'][
            Math.floor(Math.random() * 4)
          ],
          humidity: Math.floor(Math.random() * 100),
        }),
      }),
    },
    prompt: 'What is the weather like in my current location?',
  });

  for await (const chunk of result.stream) {
    switch (chunk.type) {
      case 'text-delta': {
        process.stdout.write(chunk.text);
        break;
      }

      case 'tool-call': {
        console.log(
          `TOOL CALL ${chunk.toolName} ${JSON.stringify(chunk.input)}`,
        );
        break;
      }

      case 'tool-result': {
        console.log(
          `TOOL RESULT ${chunk.toolName} ${JSON.stringify(chunk.output)}`,
        );
        break;
      }

      case 'finish-step': {
        console.log();
        console.log();
        console.log('STEP FINISH');
        console.log('Finish reason:', chunk.finishReason);
        console.log('Usage:', chunk.usage);
        console.log();
        break;
      }

      case 'finish': {
        console.log('FINISH');
        console.log('Finish reason:', chunk.finishReason);
        console.log('Total Usage:', chunk.totalUsage);
        break;
      }

      case 'error':
        console.error('Error:', chunk.error);
        break;
    }
  }
});
