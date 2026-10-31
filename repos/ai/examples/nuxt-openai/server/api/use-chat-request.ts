import { createOpenAI } from '@ai-sdk/openai';
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from 'ai';
export default defineLazyEventHandler(async () => {
  const openai = createOpenAI({
    apiKey: useRuntimeConfig().openaiApiKey,
  });

  return defineEventHandler(async (event: any) => {
    // Extract the `messages` from the body of the request
    const { message } = await readBody(event);

    // Implement your own logic here to add message history
    const previousMessages: UIMessage[] = [];
    const messages = [...previousMessages, message];

    // Call the language model
    const result = streamText({
      model: openai('gpt-4o-mini'),
      messages: await convertToModelMessages(messages),
      async onEnd({ text, toolCalls, toolResults, usage, finishReason }) {
        // Implement your own logic here, e.g. for storing messages
      },
    });

    // Respond with the stream
    return createUIMessageStreamResponse({
      stream: toUIMessageStream({ stream: result.stream }),
    });
  });
});
