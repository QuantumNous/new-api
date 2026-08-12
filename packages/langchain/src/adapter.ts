import {
  SystemMessage,
  type BaseMessage,
  type AIMessageChunk,
} from '@langchain/core/messages';
import {
  convertToModelMessages,
  type UIMessage,
  type UIMessageChunk,
  type ModelMessage,
} from 'ai';
import {
  convertToolResultPart,
  convertAssistantContent,
  convertUserContent,
  processModelChunk,
  processLangGraphEvent,
  parseLangGraphEvent,
  isToolResultPart,
  extractReasoningFromContentBlocks,
  extractCitationsFromContentBlocks,
  emitSourceChunks,
} from './utils';
import type { LangGraphEventState } from './types';
import type { StreamCallbacks } from './stream-callbacks';

/**
 * Converts AI SDK UIMessages to LangChain BaseMessage objects.
 *
 * This function transforms the AI SDK's message format into LangChain's message
 * format, enabling seamless integration between the two frameworks.
 *
 * @param messages - Array of AI SDK UIMessage objects to convert.
 * @returns Promise resolving to an array of LangChain BaseMessage objects.
 *
 * @example
 * ```ts
 * import { toBaseMessages } from '@ai-sdk/langchain';
 *
 * const langchainMessages = await toBaseMessages(uiMessages);
 *
 * // Use with LangChain
 * const response = await model.invoke(langchainMessages);
 * ```
 */
export async function toBaseMessages(
  messages: UIMessage[],
): Promise<BaseMessage[]> {
  const modelMessages = await convertToModelMessages(messages);
  return convertModelMessages(modelMessages);
}

/**
 * Converts ModelMessages to LangChain BaseMessage objects.
 *
 * @param modelMessages - Array of ModelMessage objects from convertToModelMessages.
 * @returns Array of LangChain BaseMessage objects.
 */
export function convertModelMessages(
  modelMessages: ModelMessage[],
): BaseMessage[] {
  const result: BaseMessage[] = [];

  for (const message of modelMessages) {
    switch (message.role) {
      case 'tool': {
        // Tool messages contain an array of tool results
        for (const item of message.content) {
          if (isToolResultPart(item)) {
            result.push(convertToolResultPart(item));
          }
        }
        break;
      }

      case 'assistant': {
        result.push(convertAssistantContent(message.content));
        break;
      }

      case 'system': {
        result.push(new SystemMessage({ content: message.content }));
        break;
      }

      case 'user': {
        result.push(convertUserContent(message.content));
        break;
      }
    }
  }

  return result;
}

/**
 * Type guard to check if a value is a streamEvents event object.
 * streamEvents produces objects with `event` and `data` properties.
 *
 * @param value - The value to check.
 * @returns True if the value is a streamEvents event object.
 */
function isStreamEventsEvent(
  value: unknown,
): value is { event: string; data: Record<string, unknown> } {
  if (value == null || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  // Check for event property being a string
  if (!('event' in obj) || typeof obj.event !== 'string') return false;
  // Check for data property being an object (but allow null/undefined)
  if (!('data' in obj)) return false;
  // data can be null in some events, treat as empty object
  return obj.data === null || typeof obj.data === 'object';
}

/**
 * Processes a streamEvents event and emits UI message chunks.
 *
 * @param event - The streamEvents event to process.
 * @param state - The state for tracking stream progress.
 * @param controller - The controller to emit UI message chunks.
 */
function processStreamEventsEvent(
  event: {
    event: string;
    data: Record<string, unknown> | null;
    run_id?: string;
    name?: string;
  },
  state: {
    started: boolean;
    messageId: string;
    reasoningStarted: boolean;
    textStarted: boolean;
    textMessageId: string | null;
    reasoningMessageId: string | null;
    emittedSourceIds: Set<string>;
  },
  controller: ReadableStreamDefaultController<UIMessageChunk>,
): void {
  /**
   * Capture run_id from event level if available (streamEvents v2 format)
   */
  if (event.run_id && !state.started) {
    state.messageId = event.run_id;
  }

  /**
   * Skip events with null/undefined data
   */
  if (!event.data) return;

  switch (event.event) {
    case 'on_chat_model_start': {
      /**
       * End the previous model turn's reasoning stream before a new LLM invocation.
       * Without this, reasoning-delta chunks from the next turn could attach to the
       * wrong reasoning part in the UI message stream.
       */
      if (state.reasoningStarted) {
        controller.enqueue({
          type: 'reasoning-end',
          id:
            state.reasoningMessageId != null
              ? state.reasoningMessageId
              : state.messageId,
        });
        state.reasoningStarted = false;
        state.reasoningMessageId = null;
      }

      /**
       * End the previous model turn's text stream before a new LLM invocation.
       * The streamEvents adapter otherwise leaves `textStarted` true, so all later
       * text-delta chunks append to the first text part — tools still grow the parts
       * array, which breaks chronological order in the assistant message.
       */
      if (state.textStarted) {
        controller.enqueue({
          type: 'text-end',
          id:
            state.textMessageId != null ? state.textMessageId : state.messageId,
        });
        state.textStarted = false;
        state.textMessageId = null;
      }

      /**
       * Handle model start — capture message metadata if available.
       * `run_id` is on the event in streamEvents v2; fall back to `data` for compatibility.
       */
      const runId = event.run_id || (event.data.run_id as string | undefined);
      if (runId) {
        state.messageId = runId;
      }
      break;
    }

    case 'on_chat_model_stream': {
      /**
       * Handle streaming token chunks
       */
      const chunk = event.data.chunk;
      if (chunk && typeof chunk === 'object') {
        /**
         * Get message ID from chunk if available
         */
        const chunkId = (chunk as { id?: string }).id;
        if (chunkId) {
          state.messageId = chunkId;
        }

        /**
         * Handle reasoning content from contentBlocks
         */
        const reasoning = extractReasoningFromContentBlocks(chunk);
        if (reasoning) {
          if (!state.reasoningStarted) {
            // Track the ID used for reasoning-start to ensure reasoning-end uses the same ID
            state.reasoningMessageId = state.messageId;
            controller.enqueue({
              type: 'reasoning-start',
              id: state.messageId,
            });
            state.reasoningStarted = true;
            state.started = true;
          }
          controller.enqueue({
            type: 'reasoning-delta',
            delta: reasoning,
            id: state.reasoningMessageId ?? state.messageId,
          });
        }

        /**
         * Extract text content from chunk
         */
        const content = (chunk as { content?: unknown }).content;
        const text =
          typeof content === 'string'
            ? content
            : Array.isArray(content)
              ? content
                  .filter(
                    (c): c is { type: 'text'; text: string } =>
                      typeof c === 'object' &&
                      c !== null &&
                      'type' in c &&
                      c.type === 'text',
                  )
                  .map(c => c.text)
                  .join('')
              : '';

        if (text) {
          /**
           * If reasoning was streamed before text, close reasoning first
           */
          if (state.reasoningStarted && !state.textStarted) {
            controller.enqueue({
              type: 'reasoning-end',
              id: state.reasoningMessageId ?? state.messageId,
            });
            state.reasoningStarted = false;
          }

          if (!state.textStarted) {
            // Track the ID used for text-start to ensure text-end uses the same ID
            state.textMessageId = state.messageId;
            controller.enqueue({ type: 'text-start', id: state.messageId });
            state.textStarted = true;
            state.started = true;
          }
          controller.enqueue({
            type: 'text-delta',
            delta: text,
            id: state.textMessageId ?? state.messageId,
          });
        }

        const citations = extractCitationsFromContentBlocks(chunk);
        if (citations.length > 0) {
          emitSourceChunks(
            citations,
            state.messageId,
            state.emittedSourceIds,
            controller,
          );
        }
      }
      break;
    }

    case 'on_tool_start': {
      /**
       * Handle tool call start
       * run_id and name are at event level in v2, check data for backwards compatibility
       */
      const runId = event.run_id || (event.data.run_id as string | undefined);
      const name = event.name || (event.data.name as string | undefined);

      if (runId && name) {
        controller.enqueue({
          type: 'tool-input-start',
          toolCallId: runId,
          toolName: name,
          dynamic: true,
        });
      }
      break;
    }

    case 'on_tool_end': {
      /**
       * Handle tool call end
       * run_id is at event level in v2, check data for backwards compatibility
       */
      const runId = event.run_id || (event.data.run_id as string | undefined);
      const output = event.data.output;

      if (runId) {
        controller.enqueue({
          type: 'tool-output-available',
          toolCallId: runId,
          output,
        });
      }
      break;
    }
  }
}

/**
 * Checks if an error is an abort error.
 */
function isAbortError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.name === 'AbortError' ||
      (error instanceof DOMException && error.name === 'AbortError')
    );
  }
  return false;
}

/**
 * Converts a LangChain stream to an AI SDK UIMessageStream.
 *
 * This function automatically detects the stream type and handles:
 * - Direct model streams (AsyncIterable from `model.stream()`)
 * - LangGraph streams (ReadableStream with `streamMode: ['values', 'messages']`)
 * - streamEvents streams (from `agent.streamEvents()` or `model.streamEvents()`)
 *
 * @param stream - A stream from LangChain model.stream(), graph.stream(), or streamEvents().
 * @param callbacks - Optional callbacks for stream lifecycle events.
 * @returns A ReadableStream of UIMessageChunk objects.
 *
 * @example
 * ```ts
 * // With a direct model stream
 * const model = new ChatOpenAI({ model: 'gpt-4o-mini' });
 * const stream = await model.stream(messages);
 * return createUIMessageStreamResponse({
 *   stream: toUIMessageStream(stream),
 * });
 *
 * // With a LangGraph stream
 * const graphStream = await graph.stream(
 *   { messages },
 *   { streamMode: ['values', 'messages'] }
 * );
 * return createUIMessageStreamResponse({
 *   stream: toUIMessageStream(graphStream),
 * });
 *
 * // With streamEvents
 * const streamEvents = agent.streamEvents(
 *   { messages },
 *   { version: "v2" }
 * );
 * return createUIMessageStreamResponse({
 *   stream: toUIMessageStream(streamEvents),
 * });
 *
 * // With callbacks for LangGraph state
 * const graphStream = await graph.stream(
 *   { messages },
 *   { streamMode: ['values', 'messages'] }
 * );
 * return createUIMessageStreamResponse({
 *   stream: toUIMessageStream<MyStateType>(graphStream, {
 *     onFinish: async (finalState) => {
 *       if (finalState) {
 *         await saveToDatabase(finalState);
 *       }
 *     },
 *     onError: (error) => console.error('Stream failed:', error),
 *     onAbort: () => console.log('Stream aborted'),
 *   }),
 * });
 * ```
 */
export function toUIMessageStream<TState = unknown>(
  stream: AsyncIterable<AIMessageChunk> | ReadableStream,
  callbacks?: StreamCallbacks<TState>,
): ReadableStream<UIMessageChunk> {
  /**
   * Track text chunks for onFinal callback
   */
  const textChunks: string[] = [];

  /** Last LangGraph values event data for onFinish callback */
  let lastValuesData: TState | undefined;

  /**
   * State for model stream handling
   */
  const modelState = {
    started: false,
    messageId: 'langchain-msg-1',
    reasoningStarted: false,
    textStarted: false,
    /** Track the ID used for text-start to ensure text-end uses the same ID */
    textMessageId: null as string | null,
    /** Track the ID used for reasoning-start to ensure reasoning-end uses the same ID */
    reasoningMessageId: null as string | null,
    emittedSourceIds: new Set<string>(),
  };

  /**
   * State for LangGraph stream handling
   */
  const langGraphState: LangGraphEventState = {
    messageSeen: new Map(),
    messageConcat: new Map(),
    emittedToolCalls: new Set<string>(),
    emittedToolInputs: new Set<string>(),
    emittedImages: new Set<string>(),
    emittedReasoningIds: new Set<string>(),
    messageReasoningIds: new Map(),
    toolCallInfoByIndex: new Map(),
    currentStep: null as number | null,
    emittedToolCallsByKey: new Map<string, string>(),
    emittedSourceIds: new Set<string>(),
  };

  /**
   * Track detected stream type: null = not yet detected
   */
  let streamType: 'model' | 'langgraph' | 'streamEvents' | null = null;

  /**
   * Get async iterator from the stream (works for both AsyncIterable and ReadableStream)
   */
  const getAsyncIterator = (): AsyncIterator<unknown> => {
    if (Symbol.asyncIterator in stream) {
      return (stream as AsyncIterable<unknown>)[Symbol.asyncIterator]();
    }
    /**
     * For ReadableStream without Symbol.asyncIterator
     */
    const reader = (stream as ReadableStream).getReader();
    return {
      async next() {
        const { done, value } = await reader.read();
        return { done, value };
      },
    };
  };

  const iterator = getAsyncIterator();

  /**
   * Create a wrapper around the controller to intercept text chunks for callbacks
   */
  const createCallbackController = (
    originalController: ReadableStreamDefaultController<UIMessageChunk>,
  ): ReadableStreamDefaultController<UIMessageChunk> => {
    return {
      get desiredSize() {
        return originalController.desiredSize;
      },
      close: () => originalController.close(),
      error: (e?: unknown) => originalController.error(e),
      enqueue: (chunk: UIMessageChunk) => {
        /**
         * Intercept text-delta chunks for callbacks
         */
        if (callbacks && chunk.type === 'text-delta' && chunk.delta) {
          textChunks.push(chunk.delta);
          callbacks.onToken?.(chunk.delta);
          callbacks.onText?.(chunk.delta);
        }
        originalController.enqueue(chunk);
      },
    };
  };

  return new ReadableStream<UIMessageChunk>({
    async start(controller) {
      await callbacks?.onStart?.();

      const wrappedController = createCallbackController(controller);
      controller.enqueue({ type: 'start' });

      try {
        while (true) {
          const { done, value } = await iterator.next();
          if (done) break;

          /**
           * Detect stream type on first value
           */
          if (streamType === null) {
            if (Array.isArray(value)) {
              streamType = 'langgraph';
            } else if (isStreamEventsEvent(value)) {
              streamType = 'streamEvents';
            } else {
              streamType = 'model';
            }
          }

          /**
           * Process based on detected type
           */
          if (streamType === 'model') {
            processModelChunk(
              value as AIMessageChunk,
              modelState,
              wrappedController,
            );
          } else if (streamType === 'streamEvents') {
            processStreamEventsEvent(
              value as {
                event: string;
                data: Record<string, unknown> | null;
                run_id?: string;
                name?: string;
              },
              modelState,
              wrappedController,
            );
          } else {
            const eventArray = value as unknown[];
            const [type, data] = parseLangGraphEvent(eventArray);

            if (type === 'values') {
              lastValuesData = data as TState;
            }

            processLangGraphEvent(
              eventArray,
              langGraphState,
              wrappedController,
            );
          }
        }

        /**
         * Finalize based on stream type
         */
        if (streamType === 'model' || streamType === 'streamEvents') {
          if (modelState.reasoningStarted) {
            controller.enqueue({
              type: 'reasoning-end',
              id: modelState.reasoningMessageId ?? modelState.messageId,
            });
          }
          if (modelState.textStarted) {
            /**
             * Use the same ID that was used for text-start
             */
            controller.enqueue({
              type: 'text-end',
              id: modelState.textMessageId ?? modelState.messageId,
            });
          }
          controller.enqueue({ type: 'finish' });
        } else if (streamType === 'langgraph') {
          /**
           * Close any open text/reasoning parts before finishing.
           * This handles streams without values events (e.g. streamMode: 'messages')
           * where the values handler never ran to emit *-end events.
           */
          for (const [id, seen] of langGraphState.messageSeen) {
            if (seen.text) {
              controller.enqueue({ type: 'text-end', id });
            }
            if (seen.reasoning) {
              controller.enqueue({ type: 'reasoning-end', id });
            }
          }

          /**
           * Emit finish-step if a step was started
           */
          if (langGraphState.currentStep !== null) {
            controller.enqueue({ type: 'finish-step' });
          }
          controller.enqueue({ type: 'finish' });
        }

        /**
         * Call onFinal callback with aggregated text
         */
        await callbacks?.onFinal?.(textChunks.join(''));
        await callbacks?.onFinish?.(lastValuesData);
      } catch (error) {
        const errorObj =
          error instanceof Error ? error : new Error(String(error));

        await callbacks?.onFinal?.(textChunks.join(''));

        if (isAbortError(error)) {
          await callbacks?.onAbort?.();
        } else {
          await callbacks?.onError?.(errorObj);
        }

        controller.enqueue({
          type: 'error',
          errorText: errorObj.message,
        });
      } finally {
        controller.close();
      }
    },
  });
}
