import {
  parseJsonEventStream,
  uiMessageChunkSchema,
  type ChatRequestOptions,
  type ChatTransport,
  type PrepareReconnectToStreamRequest,
  type PrepareSendMessagesRequest,
  type UIMessage,
  type UIMessageChunk,
} from 'ai';
import {
  convertAsyncIteratorToReadableStream,
  getErrorMessage,
} from '@ai-sdk/provider-utils';
import { createAsyncIterableStream } from 'ai/internal';
import { normalizeUIMessageStreamParts } from './normalize-ui-message-stream.js';

export interface SendMessagesOptions<UI_MESSAGE extends UIMessage> {
  trigger: 'submit-message' | 'regenerate-message';
  chatId: string;
  messageId?: string;
  messages: UI_MESSAGE[];
  abortSignal?: AbortSignal;
}

export interface ReconnectToStreamOptions {
  chatId: string;
  abortSignal?: AbortSignal;
  /**
   * Override the `startIndex` for this reconnection.
   * Negative values read from the end of the stream.
   * When omitted, falls back to the constructor's `initialStartIndex`.
   */
  startIndex?: number;
}

type OnChatSendMessage<UI_MESSAGE extends UIMessage> = (
  response: Response,
  options: SendMessagesOptions<UI_MESSAGE>,
) => void | Promise<void>;

type OnChatEnd = ({
  chatId,
  chunkIndex,
}: {
  chatId: string;
  chunkIndex: number;
}) => void | Promise<void>;

/**
 * Configuration options for the WorkflowChatTransport.
 *
 * @template UI_MESSAGE - The type of UI messages being sent and received,
 *                        must extend the UIMessage interface from the AI SDK.
 */
export interface WorkflowChatTransportOptions<UI_MESSAGE extends UIMessage> {
  /**
   * API endpoint for chat requests
   * Defaults to /api/chat if not provided
   */
  api?: string;

  /**
   * Custom fetch implementation to use for HTTP requests.
   * Defaults to the global fetch function if not provided.
   */
  fetch?: typeof fetch;

  /**
   * Callback invoked after successfully sending messages to the chat endpoint.
   * Useful for tracking chat history and inspecting response headers.
   *
   * @param response - The HTTP response object from the chat endpoint
   * @param options - The original options passed to sendMessages
   */
  onChatSendMessage?: OnChatSendMessage<UI_MESSAGE>;

  /**
   * Callback invoked when a chat stream ends (receives a "finish" chunk).
   * Useful for cleanup operations or state updates.
   *
   * @param chatId - The ID of the chat that ended
   * @param chunkIndex - The total number of chunks received
   */
  onChatEnd?: OnChatEnd;

  /**
   * Maximum number of consecutive errors allowed during reconnection attempts.
   * Defaults to 3 if not provided.
   */
  maxConsecutiveErrors?: number;

  /**
   * Default `startIndex` to use when reconnecting to a stream without a known
   * chunk position (i.e. the initial reconnection, not a retry).
   * Negative values read from the end of the stream (e.g. `-10` fetches the
   * last 10 chunks), which is useful for resuming a chat UI after a page
   * refresh without replaying the full conversation.
   *
   * Can be overridden per-call via `ReconnectToStreamOptions.startIndex`.
   *
   * Defaults to `0` (replay from the beginning).
   */
  initialStartIndex?: number;

  /**
   * Function to prepare the request for sending messages.
   * Allows customizing the API endpoint, headers, credentials, and body.
   */
  prepareSendMessagesRequest?: PrepareSendMessagesRequest<UI_MESSAGE>;

  /**
   * Function to prepare the request for reconnecting to a stream.
   * Allows customizing the API endpoint, headers, and credentials.
   */
  prepareReconnectToStreamRequest?: PrepareReconnectToStreamRequest;
}

/**
 * A transport implementation for managing chat workflows with support for
 * streaming responses and automatic reconnection to interrupted streams.
 *
 * This class implements the ChatTransport interface from the AI SDK and provides
 * reliable message streaming with automatic recovery from network interruptions
 * or function timeouts.
 *
 * @template UI_MESSAGE - The type of UI messages being sent and received,
 *                        must extend the UIMessage interface from the AI SDK.
 *
 * @implements {ChatTransport<UI_MESSAGE>}
 */
export class WorkflowChatTransport<
  UI_MESSAGE extends UIMessage,
> implements ChatTransport<UI_MESSAGE> {
  private readonly api: string;
  private readonly fetch: typeof fetch;
  private readonly onChatSendMessage?: OnChatSendMessage<UI_MESSAGE>;
  private readonly onChatEnd?: OnChatEnd;
  private readonly maxConsecutiveErrors: number;
  private readonly initialStartIndex: number;
  private readonly prepareSendMessagesRequest?: PrepareSendMessagesRequest<UI_MESSAGE>;
  private readonly prepareReconnectToStreamRequest?: PrepareReconnectToStreamRequest;

  /**
   * Creates a new WorkflowChatTransport instance.
   *
   * @param options - Configuration options for the transport
   * @param options.api - API endpoint for chat requests (defaults to '/api/chat')
   * @param options.fetch - Custom fetch implementation (defaults to global fetch)
   * @param options.onChatSendMessage - Callback after sending messages
   * @param options.onChatEnd - Callback when chat stream ends
   * @param options.maxConsecutiveErrors - Maximum consecutive errors for reconnection
   * @param options.prepareSendMessagesRequest - Function to prepare send messages request
   * @param options.prepareReconnectToStreamRequest - Function to prepare reconnect request
   */
  constructor(options: WorkflowChatTransportOptions<UI_MESSAGE> = {}) {
    this.api = options.api ?? '/api/chat';
    this.fetch = options.fetch ?? fetch.bind(globalThis);
    this.onChatSendMessage = options.onChatSendMessage;
    this.onChatEnd = options.onChatEnd;
    this.maxConsecutiveErrors = options.maxConsecutiveErrors ?? 3;
    this.initialStartIndex = options.initialStartIndex ?? 0;
    this.prepareSendMessagesRequest = options.prepareSendMessagesRequest;
    this.prepareReconnectToStreamRequest =
      options.prepareReconnectToStreamRequest;
  }

  /**
   * Sends messages to the chat endpoint and returns a stream of response chunks.
   *
   * This method handles the entire chat lifecycle including:
   * - Sending messages to the /api/chat endpoint
   * - Streaming response chunks
   * - Automatic reconnection if the stream is interrupted
   *
   * @param options - Options for sending messages
   * @param options.trigger - The type of message submission ('submit-message' or 'regenerate-message')
   * @param options.chatId - Unique identifier for this chat session
   * @param options.messageId - Optional message ID for tracking specific messages
   * @param options.messages - Array of UI messages to send
   * @param options.abortSignal - Optional AbortSignal to cancel the request
   *
   * @returns A ReadableStream of UIMessageChunk objects containing the response
   * @throws Error if the fetch request fails or returns a non-OK status
   */
  async sendMessages(
    options: SendMessagesOptions<UI_MESSAGE> & ChatRequestOptions,
  ): Promise<ReadableStream<UIMessageChunk>> {
    return convertAsyncIteratorToReadableStream(
      normalizeUIMessageStreamParts(this.sendMessagesIterator(options)),
    );
  }

  private async *sendMessagesIterator(
    options: SendMessagesOptions<UI_MESSAGE> & ChatRequestOptions,
  ): AsyncGenerator<UIMessageChunk> {
    const { chatId, messages, abortSignal, trigger, messageId } = options;

    // We keep track of if the "finish" chunk is received to determine
    // if we need to reconnect, and keep track of the chunk index to resume from.
    let gotFinish = false;
    let chunkIndex = 0;

    // Prepare the request using the configurator if provided
    const requestConfig = this.prepareSendMessagesRequest
      ? await this.prepareSendMessagesRequest({
          id: chatId,
          messages,
          requestMetadata: options.metadata,
          body: options.body,
          credentials: undefined,
          headers: options.headers,
          api: this.api,
          trigger,
          messageId,
        })
      : undefined;

    const url = requestConfig?.api ?? this.api;
    const response = await this.fetch(url, {
      method: 'POST',
      body: JSON.stringify(
        requestConfig?.body ?? { messages, ...options.body },
      ),
      headers: requestConfig?.headers,
      credentials: requestConfig?.credentials,
      signal: abortSignal,
    });

    if (!response.ok || !response.body) {
      throw new Error(
        `Failed to fetch chat: ${response.status} ${await response.text()}`,
      );
    }

    const workflowRunId = response.headers.get('x-workflow-run-id');
    if (!workflowRunId) {
      throw new Error(
        'Workflow run ID not found in "x-workflow-run-id" response header',
      );
    }

    // Notify the caller that the chat POST request was sent.
    // This is useful for tracking the chat history on the client
    // side and allows for inspecting response headers.
    await this.onChatSendMessage?.(response, options);

    // Flush the initial stream until the end or an error occurs
    try {
      const chunkStream = parseJsonEventStream({
        stream: response.body,
        schema: uiMessageChunkSchema,
      });
      for await (const chunk of createAsyncIterableStream(chunkStream)) {
        if (!chunk.success) {
          throw chunk.error;
        }

        chunkIndex++;

        yield chunk.value;

        if (chunk.value.type === 'finish') {
          gotFinish = true;
        }
      }
    } catch (error) {
      console.error('Error in chat POST stream', error);
    }

    if (gotFinish) {
      await this.onFinish(gotFinish, { chatId, chunkIndex });
    } else {
      // If the initial POST request did not include the "finish" chunk,
      // we need to reconnect to the stream. This could indicate that a
      // network error occurred or the Vercel Function timed out.
      yield* this.reconnectToStreamIterator(options, workflowRunId, chunkIndex);
    }
  }

  /**
   * Reconnects to an existing chat stream that was previously interrupted.
   *
   * This method is useful for resuming a chat session after network issues,
   * page refreshes, or Vercel Function timeouts.
   *
   * @param options - Options for reconnecting to the stream
   * @param options.chatId - The chat ID to reconnect to
   *
   * @returns A ReadableStream of UIMessageChunk objects
   * @throws Error if the reconnection request fails or returns a non-OK status
   */
  async reconnectToStream(
    options: ReconnectToStreamOptions & ChatRequestOptions,
  ): Promise<ReadableStream<UIMessageChunk> | null> {
    const reconnectIterator = normalizeUIMessageStreamParts(
      this.reconnectToStreamIterator(options),
    );
    return convertAsyncIteratorToReadableStream(reconnectIterator);
  }

  private async *reconnectToStreamIterator(
    options: ReconnectToStreamOptions & ChatRequestOptions,
    workflowRunId?: string,
    initialChunkIndex = 0,
  ): AsyncGenerator<UIMessageChunk> {
    let chunkIndex = initialChunkIndex;

    // When called from the public reconnectToStream (initialChunkIndex === 0),
    // honour the caller's startIndex (or the constructor default) for the
    // first request. This enables negative values so the client can read only
    // the tail of the stream (e.g. the last 10 chunks) instead of replaying
    // everything. After the first request, fall back to the running chunkIndex
    // so that retries resume from the correct position.
    const explicitStartIndex = options.startIndex ?? this.initialStartIndex;
    let useExplicitStartIndex =
      initialChunkIndex === 0 && explicitStartIndex !== 0;

    const defaultApi = `${this.api}/${encodeURIComponent(workflowRunId ?? options.chatId)}/stream`;

    // Prepare the request using the configurator if provided
    const requestConfig = this.prepareReconnectToStreamRequest
      ? await this.prepareReconnectToStreamRequest({
          id: options.chatId,
          requestMetadata: options.metadata,
          body: undefined,
          credentials: undefined,
          headers: undefined,
          api: defaultApi,
        })
      : undefined;

    const baseUrl = requestConfig?.api ?? defaultApi;

    let gotFinish = false;
    let consecutiveErrors = 0;
    // When a negative startIndex is used but the tail-index header is absent,
    // retries fall back to startIndex 0 (replay everything) instead of using
    // the incremental chunkIndex which would be wrong.
    let replayFromStart = false;

    while (!gotFinish) {
      const startIndex = useExplicitStartIndex
        ? explicitStartIndex
        : replayFromStart
          ? 0
          : chunkIndex;

      const url = `${baseUrl}?startIndex=${startIndex}`;
      const response = await this.fetch(url, {
        headers: requestConfig?.headers,
        credentials: requestConfig?.credentials,
        signal: options.abortSignal,
      });

      if (!response.ok || !response.body) {
        throw new Error(
          `Failed to fetch chat: ${response.status} ${await response.text()}`,
        );
      }

      // When using a negative startIndex, the server resolves it to an
      // absolute position. The reconnection endpoint should return the tail
      // index so we can compute the resolved position for subsequent retries.
      if (useExplicitStartIndex && explicitStartIndex > 0) {
        // Positive startIndex: the first request starts at this absolute
        // position, so set chunkIndex to match so subsequent retries
        // resume from (explicitStartIndex + chunks received).
        chunkIndex = explicitStartIndex;
      } else if (useExplicitStartIndex && explicitStartIndex < 0) {
        const tailIndexHeader = response.headers.get(
          'x-workflow-stream-tail-index',
        );
        const tailIndex =
          tailIndexHeader !== null ? parseInt(tailIndexHeader, 10) : NaN;

        if (!Number.isNaN(tailIndex)) {
          // Resolve: e.g. tailIndex=499, startIndex=-20 → 500 + (-20) = 480
          chunkIndex = Math.max(0, tailIndex + 1 + explicitStartIndex);
        } else {
          // Header missing or unparseable — fall back to replaying from the
          // beginning so retries don't resume from a wrong position.
          console.warn(
            '[WorkflowChatTransport] Negative initialStartIndex is configured ' +
              `(${explicitStartIndex}) but the reconnection endpoint did not ` +
              'return a valid "x-workflow-stream-tail-index" header. Retries ' +
              'will replay the stream from the beginning. See: ' +
              'https://workflow.dev/docs/ai/resumable-streams#resuming-from-the-end-of-the-stream',
          );
          replayFromStart = true;
        }
      }
      useExplicitStartIndex = false;

      try {
        const chunkStream = parseJsonEventStream({
          stream: response.body,
          schema: uiMessageChunkSchema,
        });
        for await (const chunk of createAsyncIterableStream(chunkStream)) {
          if (!chunk.success) {
            throw chunk.error;
          }

          chunkIndex++;

          yield chunk.value;

          if (chunk.value.type === 'finish') {
            gotFinish = true;
          }
        }
        // Reset consecutive error count only after successful stream parsing
        consecutiveErrors = 0;
      } catch (error) {
        console.error('Error in chat GET reconnectToStream', error);
        consecutiveErrors++;

        if (consecutiveErrors >= this.maxConsecutiveErrors) {
          throw new Error(
            `Failed to reconnect after ${this.maxConsecutiveErrors} consecutive errors. Last error: ${getErrorMessage(error)}`,
          );
        }
      }
    }

    await this.onFinish(gotFinish, { chatId: options.chatId, chunkIndex });
  }

  private async onFinish(
    gotFinish: boolean,
    { chatId, chunkIndex }: { chatId: string; chunkIndex: number },
  ) {
    if (gotFinish) {
      await this.onChatEnd?.({ chatId, chunkIndex });
    } else {
      throw new Error('No finish chunk received');
    }
  }
}
