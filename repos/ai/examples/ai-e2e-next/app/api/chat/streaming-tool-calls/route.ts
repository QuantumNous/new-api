import { openai } from '@ai-sdk/openai';
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIDataTypes,
  type UIMessage,
} from 'ai';
import { z } from 'zod';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export type StreamingToolCallsMessage = UIMessage<
  never,
  UIDataTypes,
  {
    showWeatherInformation: {
      input: {
        city: string;
        weather: string;
        temperature: number;
        typicalWeather: string;
      };
      output: string;
    };
  }
>;

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai('gpt-4o'),
    messages: await convertToModelMessages(messages),
    instructions:
      'You are a helpful assistant that answers questions about the weather in a given city.' +
      'You use the showWeatherInformation tool to show the weather information to the user instead of talking about it.',
    tools: {
      // server-side tool with execute function:
      getWeatherInformation: {
        description: 'show the weather in a given city to the user',
        inputSchema: z.object({ city: z.string() }),
        execute: async ({}: { city: string }) => {
          const weatherOptions = ['sunny', 'cloudy', 'rainy', 'snowy', 'windy'];
          return {
            weather:
              weatherOptions[Math.floor(Math.random() * weatherOptions.length)],
            temperature: Math.floor(Math.random() * 50 - 10),
          };
        },
      },
      // client-side tool that displays weather information to the user:
      showWeatherInformation: {
        description:
          'Show the weather information to the user. Always use this tool to tell weather information to the user.',
        inputSchema: z.object({
          city: z.string(),
          weather: z.string(),
          temperature: z.number(),
          typicalWeather: z
            .string()
            .describe(
              '2-3 sentences about the typical weather in the city during spring.',
            ),
        }),
      },
    },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
