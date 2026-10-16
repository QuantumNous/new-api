import { createOpenAI } from '@ai-sdk/openai';
import {
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
} from 'ai';

export default defineLazyEventHandler(async () => {
  const apiKey = useRuntimeConfig().openaiApiKey;
  if (!apiKey) throw new Error('Missing OpenAI API key');
  const openai = createOpenAI({ apiKey });

  return defineEventHandler(async (event: any) => {
    // Extract the `prompt` from the body of the request
    const { prompt } = await readBody(event);

    // Ask OpenAI for a streaming chat completion given the prompt
    const result = streamText({
      model: openai('gpt-4o'),
      prompt,
    });

    // Respond with the stream
    return createUIMessageStreamResponse({
      stream: toUIMessageStream({ stream: result.stream }),
    });
  });
});
