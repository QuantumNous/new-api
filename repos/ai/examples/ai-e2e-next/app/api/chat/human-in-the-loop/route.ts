import { openai } from '@ai-sdk/openai';
import {
  createUIMessageStreamResponse,
  streamText,
  createUIMessageStream,
  convertToModelMessages,
  isStepCount,
  toUIMessageStream,
} from 'ai';
import { processToolCalls } from './utils';
import { tools } from './tools';
import type { HumanInTheLoopUIMessage } from './types';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages }: { messages: HumanInTheLoopUIMessage[] } =
    await req.json();

  const stream = createUIMessageStream({
    originalMessages: messages,
    execute: async ({ writer }) => {
      // Utility function to handle tools that require human confirmation
      // Checks for confirmation in last message and then runs associated tool
      const processedMessages = await processToolCalls(
        {
          messages,
          writer,
          tools,
        },
        {
          // type-safe object for tools without an execute function
          getWeatherInformation: async ({ city }) => {
            const conditions = ['sunny', 'cloudy', 'rainy', 'snowy'];
            return `The weather in ${city} is ${
              conditions[Math.floor(Math.random() * conditions.length)]
            }.`;
          },
        },
      );

      const result = streamText({
        model: openai('gpt-4o'),
        messages: await convertToModelMessages(processedMessages),
        tools,
        stopWhen: isStepCount(20),
      });

      writer.merge(
        toUIMessageStream({
          stream: result.stream,
          originalMessages: processedMessages,
        }),
      );
    },
    onStepFinish: ({ messages, responseMessage }) => {
      console.log('--- Step finished ---');
      console.log('Parts count:', responseMessage.parts.length);
      console.log('Messages:', JSON.stringify(messages, null, 2));
    },
    onFinish: ({}) => {
      // save messages here
      console.log('Finished!');
    },
  });

  return createUIMessageStreamResponse({ stream });
}
