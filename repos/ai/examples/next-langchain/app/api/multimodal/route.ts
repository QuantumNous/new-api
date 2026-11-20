import { createUIMessageStreamResponse, type UIMessage } from 'ai';
import { NextResponse } from 'next/server';

import { ChatOpenAI } from '@langchain/openai';
import { toBaseMessages, toUIMessageStream } from '@ai-sdk/langchain';

/**
 * Allow streaming responses up to 60 seconds for image analysis
 */
export const maxDuration = 60;

/**
 * The model to use for vision analysis
 * GPT-4o has excellent vision capabilities for image understanding
 */
const model = new ChatOpenAI({
  model: 'gpt-4o',
});

/**
 * The API route for multimodal chat with image input support
 * This demonstrates sending images TO the model for analysis using the
 * AI SDK's multimodal content format converted to LangChain messages.
 *
 * @param req - The request object containing messages with potential image parts
 * @returns The streaming response from the vision model
 */
export async function POST(req: Request) {
  try {
    const { messages }: { messages: UIMessage[] } = await req.json();

    /**
     * Convert AI SDK UIMessages to LangChain messages
     * This now properly handles multimodal content (images, files) thanks to
     * the updated convertUserContent function in @ai-sdk/langchain
     */
    const langchainMessages = await toBaseMessages(messages);

    /**
     * Stream from the vision model
     * Images in user messages are automatically converted to LangChain's
     * multimodal content format with proper source_type and data/url
     */
    const stream = await model.stream(langchainMessages);

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
