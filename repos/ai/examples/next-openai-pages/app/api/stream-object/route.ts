import { openai } from '@ai-sdk/openai';
import { createTextStreamResponse, Output, streamText, toTextStream } from 'ai';
import { z } from 'zod';

export const maxDuration = 30;

export async function POST(req: Request) {
  const context = await req.json();

  const result = streamText({
    model: openai('gpt-5-mini'),
    output: Output.object({
      schema: z.object({
        notifications: z.array(
          z.object({
            name: z.string().describe('Name of a fictional person.'),
            message: z
              .string()
              .describe('Message. Do not use emojis or links.'),
          }),
        ),
      }),
    }),
    prompt:
      `Generate 3 notifications for a messages app in this context:` + context,
  });

  return createTextStreamResponse({
    stream: toTextStream({ stream: result.stream }),
  });
}
