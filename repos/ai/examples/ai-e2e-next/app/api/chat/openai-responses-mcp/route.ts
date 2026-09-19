import { openai } from '@ai-sdk/openai';
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
  type InferUITools,
} from 'ai';
export const maxDuration = 30;

const tools = {
  mcp: openai.tools.mcp({
    serverLabel: 'exaMCP',
    serverUrl: 'https://mcp.exa.ai/mcp',
    serverDescription: 'A project management tool / API for AI agents',
  }),
} as const;

export type OpenAIResponsesMCPMessage = UIMessage<
  never,
  never,
  InferUITools<typeof tools>
>;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: openai.responses('gpt-5-mini'),
    prompt: await convertToModelMessages(messages),
    tools,
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
