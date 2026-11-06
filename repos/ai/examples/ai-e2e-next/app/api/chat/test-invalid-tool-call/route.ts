import { openai } from '@ai-sdk/openai';
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  tool,
  toUIMessageStream,
  type InferUITools,
  type UIDataTypes,
  type UIMessage,
} from 'ai';
import { convertArrayToReadableStream, MockLanguageModelV3 } from 'ai/test';
import { z } from 'zod';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

const getWeatherInformationTool = tool({
  description: 'show the weather in a given city to the user',
  inputSchema: z.object({ city: z.string() }),
  execute: async ({ city }: { city: string }) => {
    // Add artificial delay of 5 seconds
    await new Promise(resolve => setTimeout(resolve, 5000));

    const weatherOptions = ['sunny', 'cloudy', 'rainy', 'snowy', 'windy'];
    return weatherOptions[Math.floor(Math.random() * weatherOptions.length)];
  },
});

const tools = {
  // server-side tool with execute function:
  getWeatherInformation: getWeatherInformationTool,
} as const;

export type UseChatToolsMessage = UIMessage<
  never,
  UIDataTypes,
  InferUITools<typeof tools>
>;

export async function POST(req: Request) {
  const { messages } = await req.json();

  console.log('messages', JSON.stringify(messages, null, 2));

  const result = streamText({
    model: openai('gpt-4o'),
    messages: await convertToModelMessages(messages),
    stopWhen: isStepCount(5), // multi-steps for server-side tools
    tools,
    prepareStep: async ({ stepNumber }) => {
      // inject invalid tool call in first step:
      if (stepNumber === 0) {
        return {
          model: new MockLanguageModelV3({
            doStream: async () => ({
              stream: convertArrayToReadableStream([
                { type: 'stream-start', warnings: [] },
                {
                  type: 'tool-input-start',
                  id: 'call-1',
                  toolName: 'getWeatherInformation',
                  providerExecuted: true,
                },
                {
                  type: 'tool-input-delta',
                  id: 'call-1',
                  delta: `{ "cities": "San Francisco" }`,
                },
                {
                  type: 'tool-input-end',
                  id: 'call-1',
                },
                {
                  type: 'tool-call',
                  toolCallType: 'function',
                  toolCallId: 'call-1',
                  toolName: 'getWeatherInformation',
                  // wrong tool call arguments (city vs cities):
                  input: `{ "cities": "San Francisco" }`,
                },
                {
                  type: 'finish',
                  finishReason: { raw: undefined, unified: 'stop' },
                  usage: {
                    inputTokens: {
                      total: 10,
                      noCache: 10,
                      cacheRead: undefined,
                      cacheWrite: undefined,
                    },
                    outputTokens: {
                      total: 20,
                      text: 20,
                      reasoning: undefined,
                    },
                  },
                },
              ]),
            }),
          }),
        };
      }
    },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      //  originalMessages: messages, //add if you want to have correct ids
      onFinish: options => {
        console.log('onFinish', options);
      },
    }),
  });
}
