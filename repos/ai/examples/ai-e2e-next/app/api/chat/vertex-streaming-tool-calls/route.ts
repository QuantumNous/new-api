import { googleVertex } from '@ai-sdk/google-vertex';
import type { GoogleLanguageModelOptions } from '@ai-sdk/google';
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIDataTypes,
  type UIMessage,
} from 'ai';
import { z } from 'zod';

export const maxDuration = 60;

export type VertexStreamingToolCallsMessage = UIMessage<
  never,
  UIDataTypes,
  {
    showWeatherInformation: {
      input: {
        city: string;
        weather: string;
        temperature: number;
        description: string;
      };
      output: string;
    };
  }
>;

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: googleVertex('gemini-3.1-pro-preview'),
    messages: await convertToModelMessages(messages),
    instructions:
      'You are a helpful weather assistant. ' +
      'Use getWeatherInformation to fetch weather data, then use showWeatherInformation to display it to the user. ' +
      'Always show the weather using the showWeatherInformation tool.',
    tools: {
      getWeatherInformation: {
        description: 'Get the current weather for a city',
        inputSchema: z.object({ city: z.string() }),
        execute: async ({ city }: { city: string }) => {
          const conditions = ['sunny', 'cloudy', 'rainy', 'snowy', 'windy'];
          return {
            city,
            weather: conditions[Math.floor(Math.random() * conditions.length)],
            temperature: Math.floor(Math.random() * 50 - 10),
          };
        },
      },
      showWeatherInformation: {
        description:
          'Show weather information to the user. Always use this tool to present weather data.',
        inputSchema: z.object({
          city: z.string(),
          weather: z.string(),
          temperature: z.number(),
          description: z
            .string()
            .describe('A brief description of the weather conditions.'),
        }),
      },
    },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
