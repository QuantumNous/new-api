import {
  openai,
  type OpenAILanguageModelResponsesOptions,
} from '@ai-sdk/openai';
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

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

const getWeatherInformationTool = tool({
  description: 'show the weather in a given city to the user',
  inputSchema: z.object({ city: z.string() }),
  async *execute({ city }: { city: string }, { messages }) {
    yield { state: 'loading' as const };

    // count the number of assistant messages. throw error if 2 or less
    const assistantMessageCount = messages.filter(
      message => message.role === 'assistant',
    ).length;

    // if (assistantMessageCount <= 2) {
    //   throw new Error('could not get weather information');
    // }

    // Add artificial delay of 5 seconds
    await new Promise(resolve => setTimeout(resolve, 5000));

    const weatherOptions = ['sunny', 'cloudy', 'rainy', 'snowy', 'windy'];
    const weather =
      weatherOptions[Math.floor(Math.random() * weatherOptions.length)];

    yield {
      state: 'ready' as const,
      temperature: 72,
      weather,
    };
  },

  onInputStart: () => {
    console.log('onInputStart');
  },
  onInputDelta: ({ inputTextDelta }) => {
    console.log('onInputDelta', inputTextDelta);
  },
  onInputAvailable: ({ input }) => {
    console.log('onInputAvailable', input);
  },
});

const askForConfirmationTool = tool({
  description: 'Ask the user for confirmation.',
  inputSchema: z.object({
    message: z.string().describe('The message to ask for confirmation.'),
  }),
  outputSchema: z.string(),
});

const getLocationTool = tool({
  description:
    'Get the user location. Always ask for confirmation before using this tool.',
  inputSchema: z.object({}),
  outputSchema: z.string(),
});

const tools = {
  // server-side tool with execute function:
  getWeatherInformation: getWeatherInformationTool,
  // client-side tool that starts user interaction:
  askForConfirmation: askForConfirmationTool,
  // client-side tool that is automatically executed on the client:
  getLocation: getLocationTool,
} as const;

export type UseChatToolsMessage = UIMessage<
  never,
  UIDataTypes,
  InferUITools<typeof tools>
>;

export async function POST(req: Request) {
  const body = await req.json();

  const messages = await validateUIMessages<UseChatToolsMessage>({
    messages: body.messages,
    tools,
  });

  const result = streamText({
    model: openai('gpt-5-mini'),
    messages: await convertToModelMessages(messages),
    stopWhen: isStepCount(5), // multi-steps for server-side tools
    tools,
    providerOptions: {
      openai: {
        // store: false,
      } satisfies OpenAILanguageModelResponsesOptions,
    },
    onStepFinish({ request }) {
      console.dir(request.body, { depth: Infinity });
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
