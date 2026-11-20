import { createUIMessageStreamResponse, type UIMessage } from 'ai';
import { NextResponse } from 'next/server';

import { ChatOpenAI } from '@langchain/openai';
import { toBaseMessages, toUIMessageStream } from '@ai-sdk/langchain';

/**
 * Allow streaming responses up to 30 seconds
 */
export const maxDuration = 30;

/**
 * The API route for the chat
 * @param req - The request object
 * @returns The response from the API
 */
export async function POST(req: Request) {
  try {
    const {
      messages,
    }: {
      /**
       * The messages to send to the model
       */
      messages: UIMessage[];
    } = await req.json();

    /**
     * The model to use for the chat
     */
    const model = new ChatOpenAI({
      model: 'gpt-4o-mini',
      temperature: 0,
    });

    /**
     * Convert AI SDK UIMessages to LangChain messages using the simplified API
     */
    const langchainMessages = await toBaseMessages(messages);

    /**
     * Stream the response from the model
     * Note: Type assertion needed due to LangChain type version mismatch
     */
    const stream = await model.stream(langchainMessages as never);

    /**
     * Convert the LangChain stream to UI message stream
     */
    return createUIMessageStreamResponse({
      stream: toUIMessageStream(stream),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
