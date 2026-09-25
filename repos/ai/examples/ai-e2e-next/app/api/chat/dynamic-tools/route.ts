import { openai } from '@ai-sdk/openai';
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  dynamicTool,
  isStepCount,
  streamText,
  tool,
  toUIMessageStream,
  type InferUITools,
  type ToolSet,
  type UIDataTypes,
  type UIMessage,
} from 'ai';
import { z } from 'zod';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

const getWeatherInformationTool = tool({
  description: 'show the weather in a given city to the user',
  inputSchema: z.object({ city: z.string() }),
  execute: async ({ city }: { city: string }, { messages }) => {
    // count the number of assistant messages. throw error if 2 or less
    const assistantMessageCount = messages.filter(
      message => message.role === 'assistant',
    ).length;

    if (assistantMessageCount <= 2) {
      throw new Error('could not get weather information');
    }

    // Add artificial delay of 5 seconds
    await new Promise(resolve => setTimeout(resolve, 5000));

    const weatherOptions = ['sunny', 'cloudy', 'rainy', 'snowy', 'windy'];
    return weatherOptions[Math.floor(Math.random() * weatherOptions.length)];
  },
});

const staticTools = {
  // server-side tool with execute function:
  getWeatherInformation: getWeatherInformationTool,
} as const;

export type ToolsMessage = UIMessage<
  never,
  UIDataTypes,
  InferUITools<typeof staticTools>
>;

function dynamicTools(): ToolSet {
  return {
    currentLocation: dynamicTool({
      description: 'Get the current location.',
      inputSchema: z.object({}),
      execute: async () => {
        const locations = ['New York', 'London', 'Paris'];
        return {
          location: locations[Math.floor(Math.random() * locations.length)],
        };
      },
    }),
  };
}

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai('gpt-4o'),
    messages: await convertToModelMessages(messages),
    stopWhen: isStepCount(5), // multi-steps for server-side tools
    tools: {
      ...staticTools,
      ...dynamicTools(),
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
