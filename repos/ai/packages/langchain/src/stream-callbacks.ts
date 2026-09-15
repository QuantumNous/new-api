/**
 * Callback options for stream lifecycle events.
 */
export interface StreamCallbacks<TState = unknown> {
  /** Called once when the stream is initialized. */
  onStart?: () => Promise<void> | void;

  /** Called for each tokenized message. */
  onToken?: (token: string) => Promise<void> | void;

  /** Called for each text chunk. */
  onText?: (text: string) => Promise<void> | void;

  /** Called with aggregated text when stream ends (success, error, or abort). */
  onFinal?: (completion: string) => Promise<void> | void;

  /**
   * Called on successful completion. Receives final graph state for LangGraph
   * streams (from last "values" event), undefined for other stream types.
   */
  onFinish?: (finalState: TState | undefined) => Promise<void> | void;

  /** Called when the stream encounters an error. */
  onError?: (error: Error) => Promise<void> | void;

  /** Called when the stream is aborted. */
  onAbort?: () => Promise<void> | void;
}

/**
 * Creates a transform stream that invokes callbacks during text stream processing.
 *
 * Lifecycle:
 * 1. `onStart` - Called once when stream initializes
 * 2. `onToken` / `onText` - Called for each chunk as it flows through
 * 3. `onFinal` - Called once when stream closes with aggregated text
 *
 * Note: This transformer only supports text-based callbacks. For LangGraph state
 * callbacks (`onFinish`, `onError`, `onAbort`), use `toUIMessageStream` instead.
 *
 * @param callbacks - Optional callback functions for stream lifecycle events.
 * @returns A TransformStream that passes through messages while invoking callbacks.
 */
export function createCallbacksTransformer(
  callbacks: StreamCallbacks | undefined = {},
): TransformStream<string, string> {
  let aggregatedResponse = '';

  return new TransformStream({
    async start(): Promise<void> {
      if (callbacks.onStart) await callbacks.onStart();
    },

    async transform(message, controller): Promise<void> {
      controller.enqueue(message);

      aggregatedResponse += message;

      if (callbacks.onToken) await callbacks.onToken(message);
      if (callbacks.onText && typeof message === 'string') {
        await callbacks.onText(message);
      }
    },

    async flush(): Promise<void> {
      if (callbacks.onFinal) {
        await callbacks.onFinal(aggregatedResponse);
      }
    },
  });
}
