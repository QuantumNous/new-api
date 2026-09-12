import { Output, createTextStreamResponse, streamText, toTextStream } from 'ai';
import { notificationSchema } from '../../structured-object/schema.js';
import { createOpenAI } from '@ai-sdk/openai';
import { env } from '$env/dynamic/private';

const openai = createOpenAI({
  apiKey: env?.OPENAI_API_KEY,
});

export async function POST({ request }: { request: Request }) {
  const context = await request.json();

  const result = streamText({
    model: openai('gpt-4o'),
    output: Output.object({ schema: notificationSchema }),
    prompt:
      `Generate 3 notifications for a messages app in this context:` + context,
    onError: error => {
      console.error(error);
    },
  });

  return createTextStreamResponse({
    stream: toTextStream({ stream: result.stream }),
  });
}
