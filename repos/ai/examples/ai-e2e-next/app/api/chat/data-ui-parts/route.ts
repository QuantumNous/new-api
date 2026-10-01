import { openai } from '@ai-sdk/openai';
import { delay } from '@ai-sdk/provider-utils';
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
} from 'ai';
import { z } from 'zod';

export async function POST(req: Request) {
  const { messages } = await req.json();
  const modelMessages = await convertToModelMessages(messages);

  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      const result = streamText({
        model: openai('gpt-4o'),
        stopWhen: isStepCount(2),
        tools: {
          weather: {
            description: 'Get the weather in a city',
            inputSchema: z.object({
              city: z.string(),
            }),
            execute: async ({ city }, { toolCallId }) => {
              // update display
              writer.write({
                type: 'data-weather',
                id: toolCallId,
                data: { city, status: 'loading' },
              });

              await delay(2000); // fake delay
              const weather = 'sunny';

              // update display
              writer.write({
                type: 'data-weather',
                id: toolCallId,
                data: { city, weather, status: 'success' },
              });

              // for LLM roundtrip
              return { city, weather };
            },
          },
        },
        messages: modelMessages,
      });

      writer.merge(toUIMessageStream({ stream: result.stream }));
    },
  });

  return createUIMessageStreamResponse({ stream });
}
