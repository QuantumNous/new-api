import { toBaseMessages, toUIMessageStream } from '@ai-sdk/langchain';
import { ChatOpenAI } from '@langchain/openai';
import { createUIMessageStreamResponse, type UIMessage } from 'ai';
import { NextResponse } from 'next/server';

export const maxDuration = 30;

/**
 * this configuration streams reasoning summaries before the final response (thus triggering the error)
 */
const model = new ChatOpenAI({
  model: 'gpt-5',
  useResponsesApi: true,
  reasoning: { effort: 'medium', summary: 'concise' },
});

export async function POST(req: Request) {
  try {
    const { messages }: { messages: UIMessage[] } = await req.json();

    const langchainMessages = await toBaseMessages(messages);
    const stream = await model.stream(langchainMessages as never);

    return createUIMessageStreamResponse({
      stream: toUIMessageStream(stream),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
