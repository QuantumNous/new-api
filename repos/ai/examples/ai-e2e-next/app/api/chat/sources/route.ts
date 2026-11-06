import { anthropic } from '@ai-sdk/anthropic';
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type InferUITool,
  type UIDataTypes,
  type UIMessage,
} from 'ai';
export type SourcesChatMessage = UIMessage<
  never,
  UIDataTypes,
  {
    web_search: InferUITool<
      ReturnType<typeof anthropic.tools.webSearch_20250305>
    >;
  }
>;

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: anthropic('claude-3-5-sonnet-latest'),
    tools: {
      web_search: anthropic.tools.webSearch_20250305(),
    },
    messages: await convertToModelMessages(messages),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      sendSources: true,
    }),
  });
}
