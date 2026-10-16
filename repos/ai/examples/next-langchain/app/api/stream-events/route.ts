import { toBaseMessages, toUIMessageStream } from '@ai-sdk/langchain';
import { ChatOpenAI } from '@langchain/openai';
import { createUIMessageStreamResponse, type UIMessage } from 'ai';
import { NextResponse } from 'next/server';

/**
 * Allow streaming responses up to 30 seconds
 */
export const maxDuration = 30;

/**
 * The model to use for streaming
 */
const model = new ChatOpenAI({
  model: 'gpt-4o-mini',
  temperature: 0,
});

/**
 * streamEvents API Example
 *
 * This example demonstrates using LangChain's `streamEvents()` method with
 * the AI SDK adapter. `streamEvents()` provides granular, semantic events
 * that are useful for:
 *
 * - **Filtering by event type**: Easily filter for specific events like
 *   `on_chat_model_stream`, `on_tool_start`, `on_chain_end`
 *
 * - **Debugging and observability**: Get detailed events about what's
 *   happening inside chains, agents, and tools
 *
 * - **Migrating LCEL apps**: When migrating large LangChain Expression
 *   Language (LCEL) applications that rely on callbacks
 *
 * - **Custom metadata access**: Access run IDs, names, and other metadata
 *   for each component in the chain
 *
 * Compare this to `graph.stream()` which is optimized for LangGraph and
 * provides structured state updates via `streamMode` options.
 *
 * @see https://docs.langchain.com/oss/javascript/langchain/streaming
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
     * Convert AI SDK UIMessages to LangChain messages
     */
    const langchainMessages = await toBaseMessages(messages);

    /**
     * Use streamEvents() to get semantic events with metadata.
     * This produces events like:
     * - { event: "on_chat_model_start", data: { input: ... } }
     * - { event: "on_chat_model_stream", data: { chunk: AIMessageChunk } }
     * - { event: "on_chat_model_end", data: { output: AIMessage } }
     *
     * The adapter automatically detects and handles this format.
     * Note: Type assertion needed due to LangChain type version mismatch
     */
    const streamEvents = model.streamEvents(langchainMessages, {
      version: 'v2',
    });

    /**
     * Convert the streamEvents stream to UI message stream.
     * The adapter auto-detects the event format and processes:
     * - on_chat_model_stream -> text-delta events
     * - on_tool_start -> tool-input-start events
     * - on_tool_end -> tool-output-available events
     *
     * Note: streamEvents returns an AsyncIterable, which toUIMessageStream
     * handles natively through its async iterator support.
     */
    return createUIMessageStreamResponse({
      stream: toUIMessageStream(streamEvents),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
