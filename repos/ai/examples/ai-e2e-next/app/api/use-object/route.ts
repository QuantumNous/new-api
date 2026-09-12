import { createTextStreamResponse, Output, streamText, toTextStream } from 'ai';
import { notificationSchema } from './schema';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const context = await req.json();

  const result = streamText({
    model: 'openai/gpt-4o',
    prompt: `Generate 3 notifications for a messages app in this context: ${context}`,
    output: Output.object({ schema: notificationSchema }),
  });

  return createTextStreamResponse({
    stream: toTextStream({ stream: result.stream }),
  });
}
