import { openai } from '@ai-sdk/openai';
import {
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
} from 'ai';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  // Extract the `prompt` from the body of the request
  const { prompt } = await req.json();

  // Ask OpenAI for a streaming completion given the prompt
  const result = streamText({
    model: openai('gpt-3.5-turbo-instruct'),
    prompt,
  });

  // Respond with the stream
  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
