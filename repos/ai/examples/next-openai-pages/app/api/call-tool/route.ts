import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: openai('gpt-5'),
    instructions: 'You are a helpful assistant.',
    messages: await convertToModelMessages(messages),
    tools: {
      celsiusToFahrenheit: {
        description: 'Converts celsius to fahrenheit',
        inputSchema: z.object({
          value: z.string().describe('The value in celsius'),
        }),
        execute: async ({ value }) => {
          const celsius = parseFloat(value);
          const fahrenheit = celsius * (9 / 5) + 32;
          return `${celsius}°C is ${fahrenheit.toFixed(2)}°F`;
        },
      },
    },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
