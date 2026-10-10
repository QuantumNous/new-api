import { openai } from '@ai-sdk/openai';
import { isStepCount, streamText, tool } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: openai('gpt-4o'),
    stopWhen: isStepCount(5),
    tools: {
      weather: tool({
        description: 'Get the current weather.',
        inputSchema: z.object({
          location: z.string(),
        }),
        outputSchema: z.union([
          z.object({
            status: z.literal('loading'),
            text: z.string(),
            weather: z.undefined(),
          }),
          z.object({
            status: z.literal('success'),
            text: z.string(),
            weather: z.object({
              location: z.string(),
              temperature: z.number(),
            }),
          }),
        ]),
        async *execute({ location }) {
          yield {
            status: 'loading' as const,
            text: `Getting weather for ${location}`,
            weather: undefined,
          };

          await new Promise(resolve => setTimeout(resolve, 3000));
          const temperature = 72 + Math.floor(Math.random() * 21) - 10;

          yield {
            status: 'success' as const,
            text: `The weather in ${location} is ${temperature}°F`,
            weather: {
              location,
              temperature,
            },
          };
        },
      }),
    },
    prompt: 'What is the weather in New York?',
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
        if (chunk.dynamic) {
          continue;
        }

        if (chunk.toolName === 'weather') {
          if (chunk.preliminary) {
            console.log(
              `PRELIMINARY TOOL RESULT ${chunk.toolName} ${JSON.stringify(chunk.output)}`,
            );
          } else {
            console.log(
              `TOOL RESULT ${chunk.toolName} ${JSON.stringify(chunk.output)}`,
            );
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
