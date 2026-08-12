import { openai } from '@ai-sdk/openai';
import {
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
} from 'ai';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

// simple cache implementation, use Vercel KV or a similar service for production
const cache = new Map<string, string>();

export async function POST(req: Request) {
  const { messages } = await req.json();

  // come up with a key based on the request:
  const key = JSON.stringify(messages);

  // Check if we have a cached response
  const cached = cache.get(key);
  if (cached != null) {
    return new Response(`data: ${cached}\n\n`, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  // Call the language model:
  const result = streamText({
    model: openai('gpt-4o'),
    messages,
    async onEnd({ text }) {
      // Cache the response text:
      cache.set(key, text);
    },
  });

  // Respond with the stream
  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
