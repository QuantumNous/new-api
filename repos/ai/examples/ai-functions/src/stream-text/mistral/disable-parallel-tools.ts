import { streamText, tool } from 'ai';
import { z } from 'zod';
import { mistral, type MistralLanguageModelChatOptions } from '@ai-sdk/mistral';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: mistral('mistral-small-latest'),
    prompt: 'What is the weather in Paris, France and London, UK?',
    tools: {
      getWeather: tool({
        description: 'Get the current weather for a location',
        inputSchema: z.object({
          location: z
            .string()
            .describe('The city and state, e.g. San Francisco, CA'),
        }),
        execute: async ({ location }: { location: string }) => {
          return `Weather in ${location}: 72°F, sunny`;
        },
      }),
    },
    providerOptions: {
      mistral: {
        parallelToolCalls: false,
      } satisfies MistralLanguageModelChatOptions,
    },
  });

  for await (const chunk of result.stream) {
    switch (chunk.type) {
      case 'text-delta': {
        process.stdout.write(chunk.text);
        break;
      }
      case 'tool-call': {
        console.log(
          `\nTOOL CALL: ${chunk.toolName}(${JSON.stringify(chunk.input)})`,
        );
        break;
      }
      case 'tool-result': {
        console.log(`TOOL RESULT: ${JSON.stringify(chunk.output)}`);
        break;
      }
    }
  }

  console.log();
  console.log('Token usage:', await result.usage);
  console.log('Finish reason:', await result.finishReason);
});
