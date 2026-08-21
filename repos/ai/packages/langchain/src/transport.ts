import type { AIMessageChunk } from '@langchain/core/messages';
import type {
  UIMessage,
  UIMessageChunk,
  ChatTransport,
  ChatRequestOptions,
} from 'ai';
import {
  RemoteGraph,
  type RemoteGraphParams,
} from '@langchain/langgraph/remote';
import { toBaseMessages, toUIMessageStream } from './adapter';

/**
 * Options for configuring a LangSmith deployment transport.
 * Extends RemoteGraphParams but makes graphId optional (defaults to 'agent').
 */
export type LangSmithDeploymentTransportOptions = Omit<
  RemoteGraphParams,
  'graphId'
> & {
  /**
   * The ID of the graph to connect to.
   * @default 'agent'
   */
  graphId?: string;
};

/**
 * A ChatTransport implementation for LangSmith/LangGraph deployments.
 *
 * This transport enables seamless integration between the AI SDK's useChat hook
 * and LangSmith deployed LangGraph agents.
 *
 * @example
 * ```ts
 * import { LangSmithDeploymentTransport } from '@ai-sdk/langchain';
 *
 * // Use with useChat
 * const { messages, input, handleSubmit } = useChat({
 *   transport: new LangSmithDeploymentTransport({
 *     url: 'https://your-deployment.us.langgraph.app',
 *     apiKey: 'my-api-key',
 *   }),
 * });
 * ```
 */
export class LangSmithDeploymentTransport<
  UI_MESSAGE extends UIMessage,
> implements ChatTransport<UI_MESSAGE> {
  protected graph: RemoteGraph;

  constructor(options: LangSmithDeploymentTransportOptions) {
    this.graph = new RemoteGraph({
      ...options,
      graphId: options.graphId ?? 'agent',
    });
  }

  async sendMessages(
    options: {
      trigger: 'submit-message' | 'regenerate-message';
      chatId: string;
      messageId: string | undefined;
      messages: UI_MESSAGE[];
      abortSignal: AbortSignal | undefined;
    } & ChatRequestOptions,
  ): Promise<ReadableStream<UIMessageChunk>> {
    const baseMessages = await toBaseMessages(options.messages);

    const stream = await this.graph.stream(
      { messages: baseMessages },
      { streamMode: ['values', 'messages'] },
    );

    return toUIMessageStream(
      stream as AsyncIterable<AIMessageChunk> | ReadableStream,
    );
  }

  async reconnectToStream(
    _options: {
      chatId: string;
    } & ChatRequestOptions,
  ): Promise<ReadableStream<UIMessageChunk> | null> {
    throw new Error('Method not implemented.');
  }
}
