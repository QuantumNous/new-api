import { createUIMessageStreamResponse, type UIMessage } from 'ai';
import { NextResponse } from 'next/server';

import { ChatOpenAI, tools } from '@langchain/openai';
import { toBaseMessages, toUIMessageStream } from '@ai-sdk/langchain';

/**
 * Allow streaming responses up to 120 seconds for image generation
 * Image generation can take longer than text responses
 */
export const maxDuration = 120;

/**
 * ChatOpenAI configured to use the Responses API
 * This enables access to OpenAI's built-in tools like image generation
 */
const model = new ChatOpenAI({
  model: 'gpt-4o',
});

/**
 * Bind the image generation tool to the model
 * This allows the model to generate images as part of its responses
 */
const modelWithImageGeneration = model.bindTools([
  tools.imageGeneration({
    size: '1024x1024',
    quality: 'medium',
    outputFormat: 'png',
  }),
]);

/**
 * System prompt that instructs the model to use image generation
 */
const SYSTEM_PROMPT = `You are a creative AI assistant that can generate images.

When a user asks you to create, draw, generate, or visualize something:
1. Use the image generation tool to create the image
2. Describe what you created in a brief, friendly response

Be creative and artistic in your interpretations. If the user's request is vague, 
add interesting details to make the image more compelling.

For non-image requests, respond helpfully as a normal assistant.`;

/**
 * API route for image generation
 * Converts user messages to LangChain format and streams the response
 */
export async function POST(req: Request) {
  try {
    const { messages }: { messages: UIMessage[] } = await req.json();

    /**
     * Convert AI SDK UIMessages to LangChain messages
     */
    const langchainMessages = await toBaseMessages(messages);

    /**
     * Add system message at the beginning
     */
    const messagesWithSystem = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      ...langchainMessages,
    ];

    /**
     * Stream from the model with image generation capability
     */
    const stream = await modelWithImageGeneration.stream(messagesWithSystem);

    /**
     * Convert the LangChain stream to UI message stream
     */
    return createUIMessageStreamResponse({
      stream: toUIMessageStream(stream as unknown as ReadableStream),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
