import { openai } from '@ai-sdk/openai';
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  tool,
  toUIMessageStream,
  validateUIMessages,
  type InferUITools,
  type UIDataTypes,
  type UIMessage,
} from 'ai';
import { z } from 'zod';

export const maxDuration = 30;

const getWeatherTool = tool({
  description: 'Get the weather for a city',
  inputSchema: z.object({ city: z.string() }),
  execute: async (_input, { abortSignal }) => {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, 10000);
      abortSignal?.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(abortSignal.reason);
      });
    });
    return { temperature: 72, condition: 'sunny' };
  },
});

const tools = {
  getWeather: getWeatherTool,
} as const;

export type ToolTimeoutMessage = UIMessage<
  never,
  UIDataTypes,
  InferUITools<typeof tools>
>;

export async function POST(req: Request) {
  const body = await req.json();

  const messages = await validateUIMessages<ToolTimeoutMessage>({
    messages: body.messages,
    tools,
  });

  const result = streamText({
    model: openai('gpt-5.4'),
    messages: await convertToModelMessages(messages),
    instructions:
      'You are a helpful weather assistant. When a tool times out, explain to the user that the weather service is unavailable and suggest they try again later.',
    tools,
    timeout: {
      toolMs: 1000,
    },
    stopWhen: isStepCount(2),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
