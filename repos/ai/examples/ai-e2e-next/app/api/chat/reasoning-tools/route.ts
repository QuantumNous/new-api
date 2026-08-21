import {
  openai,
  type OpenAILanguageModelResponsesOptions,
} from '@ai-sdk/openai';
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type InferUITools,
  type UIDataTypes,
  type UIMessage,
} from 'ai';
const tools = {
  web_search: openai.tools.webSearch({
    searchContextSize: 'high',
    userLocation: {
      type: 'approximate',
      city: 'San Francisco',
      region: 'California',
      country: 'US',
    },
  }),
} as const;

export type ReasoningToolsMessage = UIMessage<
  never, // could define metadata here
  UIDataTypes, // could define data parts here
  InferUITools<typeof tools>
>;

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages } = await req.json();

  console.log(JSON.stringify(messages, null, 2));

  const result = streamText({
    model: openai('gpt-5.6'),
    messages: await convertToModelMessages(messages),
    tools,
    providerOptions: {
      openai: {
        reasoningSummary: 'detailed', // 'auto' for condensed or 'detailed' for comprehensive
      } satisfies OpenAILanguageModelResponsesOptions,
    },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
