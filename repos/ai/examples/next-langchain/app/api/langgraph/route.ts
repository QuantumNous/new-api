import { toBaseMessages, toUIMessageStream } from '@ai-sdk/langchain';
import { ChatOpenAI } from '@langchain/openai';
import { createUIMessageStreamResponse, type UIMessage } from 'ai';
import { StateGraph, MessagesAnnotation } from '@langchain/langgraph';
import { NextResponse } from 'next/server';

/**
 * Allow streaming responses up to 30 seconds
 */
export const maxDuration = 30;

/**
 * The model to use for the graph
 */
const model = new ChatOpenAI({
  model: 'gpt-4o-mini',
  temperature: 0,
});

/**
 * Calls the model and returns the response as new graph state
 * @param state - The state of the graph
 * @returns The response from the model
 */
async function callModel(state: typeof MessagesAnnotation.State) {
  const response = await model.invoke(state.messages);
  return { messages: [response] };
}

/**
 * The API route for the LangGraph agent
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
     * Create the LangGraph agent
     */
    const graph = new StateGraph(MessagesAnnotation)
      .addNode('agent', callModel)
      .addEdge('__start__', 'agent')
      .addEdge('agent', '__end__')
      .compile();

    /**
     * Convert AI SDK UIMessages to LangChain messages using the simplified API
     */
    const langchainMessages = await toBaseMessages(messages);

    /**
     * Stream from the graph using LangGraph's streaming format
     * Note: Type assertion needed due to LangChain type version mismatch
     */
    const stream = await graph.stream(
      { messages: langchainMessages as never },
      { streamMode: ['values', 'messages'] },
    );

    /**
     * Convert the LangGraph stream to UI message stream using the adapter
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
