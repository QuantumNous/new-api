import { createUIMessageStreamResponse } from 'ai';
import { NextResponse } from 'next/server';

import { ChatOpenAI } from '@langchain/openai';
import { toUIMessageStream } from '@ai-sdk/langchain';

/**
 * Allow streaming responses up to 30 seconds
 */
export const maxDuration = 30;

/**
 * The API route for text completion using useCompletion hook
 * @param req - The request object
 * @returns The response from the API
 */
export async function POST(req: Request) {
  try {
    const { prompt }: { prompt: string } = await req.json();

    /**
     * The model to use for completion
     */
    const model = new ChatOpenAI({
      model: 'gpt-4o-mini',
      temperature: 0.7,
    });

    /**
     * Stream the response from the model using a simple prompt
     * Note: We wrap the prompt in a HumanMessage format for the chat model
     */
    const stream = await model.stream([{ role: 'user', content: prompt }]);

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
