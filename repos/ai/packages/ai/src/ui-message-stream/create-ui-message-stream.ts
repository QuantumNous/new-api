import {
  generateId as generateIdFunc,
  type IdGenerator,
} from '@ai-sdk/provider-utils';
import type { UIMessage } from '../ui/ui-messages';
import { handleUIMessageStreamFinish } from './handle-ui-message-stream-finish';
import type { InferUIMessageChunk } from './ui-message-chunks';
import type { UIMessageStreamOnEndCallback } from './ui-message-stream-on-end-callback';
import type { UIMessageStreamOnStepEndCallback } from './ui-message-stream-on-step-end-callback';
import type { UIMessageStreamOnStepFinishCallback } from './ui-message-stream-on-step-finish-callback';
import type { UIMessageStreamWriter } from './ui-message-stream-writer';

/**
 * Creates a UI message stream that can be used to send messages to the client.
 *
 * @param options.execute - A function that is called with a writer to write UI message chunks to the stream.
 * @param options.onError - A function that extracts an error message from an error. Defaults to `() => 'An error occurred.'` so server-side error details are not leaked to the client; supply your own to surface richer messages.
 * @param options.originalMessages - The original messages. If provided, persistence mode is assumed
 *   and a message ID is provided for the response message.
 * @param options.onStepEnd - A callback that is called when each step ends. Useful for persisting intermediate messages.
 * @param options.onStepFinish - Deprecated alias for `onStepEnd`.
 * @param options.onEnd - A callback that is called when the stream ends.
 * @param options.onFinish - Deprecated alias for `onEnd`.
 * @param options.generateId - A function that generates a unique ID. Defaults to the built-in ID generator.
 *
 * @returns A `ReadableStream` of UI message chunks.
 */
export function createUIMessageStream<UI_MESSAGE extends UIMessage>({
  execute,
  onError = () => 'An error occurred.', // prevent leaking server error details to the client by default
  originalMessages,
  onStepEnd,
  onStepFinish,
  onEnd,
  onFinish,
  generateId = generateIdFunc,
}: {
  execute: (options: {
    writer: UIMessageStreamWriter<UI_MESSAGE>;
  }) => Promise<void> | void;
  onError?: (error: unknown) => string;

  /**
   * The original messages. If they are provided, persistence mode is assumed,
   * and a message ID is provided for the response message.
   */
  originalMessages?: UI_MESSAGE[];

  /**
   * Callback that is called when each step ends during multi-step agent runs.
   */
  onStepEnd?: UIMessageStreamOnStepEndCallback<UI_MESSAGE>;

  /**
   * Callback that is called when each step ends during multi-step agent runs.
   *
   * @deprecated Use `onStepEnd` instead.
   */
  onStepFinish?: UIMessageStreamOnStepFinishCallback<UI_MESSAGE>;

  onEnd?: UIMessageStreamOnEndCallback<UI_MESSAGE>;

  /**
   * @deprecated Use `onEnd` instead.
   */
  onFinish?: UIMessageStreamOnEndCallback<UI_MESSAGE>;

  generateId?: IdGenerator;
}): ReadableStream<InferUIMessageChunk<UI_MESSAGE>> {
  let controller!: ReadableStreamDefaultController<
    InferUIMessageChunk<UI_MESSAGE>
  >;

  const ongoingStreamPromises: Promise<void>[] = [];

  const stream = new ReadableStream({
    start(controllerArg) {
      controller = controllerArg;
    },
  });

  function safeEnqueue(data: InferUIMessageChunk<UI_MESSAGE>) {
    try {
      controller.enqueue(data);
    } catch {
      // suppress errors when the stream has been closed
    }
  }

  try {
    const result = execute({
      writer: {
        write(part: InferUIMessageChunk<UI_MESSAGE>) {
          safeEnqueue(part);
        },
        merge(streamArg) {
          ongoingStreamPromises.push(
            (async () => {
              const reader = streamArg.getReader();
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                safeEnqueue(value);
              }
            })().catch(error => {
              safeEnqueue({
                type: 'error',
                errorText: onError(error),
              } as InferUIMessageChunk<UI_MESSAGE>);
            }),
          );
        },
        onError,
      },
    });

    if (result) {
      ongoingStreamPromises.push(
        result.catch(error => {
          safeEnqueue({
            type: 'error',
            errorText: onError(error),
          } as InferUIMessageChunk<UI_MESSAGE>);
        }),
      );
    }
  } catch (error) {
    safeEnqueue({
      type: 'error',
      errorText: onError(error),
    } as InferUIMessageChunk<UI_MESSAGE>);
  }

  // Wait until all ongoing streams are done. This approach enables merging
  // streams even after execute has returned, as long as there is still an
  // open merged stream. This is important to e.g. forward new streams and
  // from callbacks.
  const waitForStreams: Promise<void> = new Promise(async resolve => {
    while (ongoingStreamPromises.length > 0) {
      await ongoingStreamPromises.shift();
    }
    resolve();
  });

  waitForStreams.finally(() => {
    try {
      controller.close();
    } catch {
      // suppress errors when the stream has been closed
    }
  });

  return handleUIMessageStreamFinish<UI_MESSAGE>({
    stream,
    messageId: generateId(),
    originalMessages,
    onStepEnd: onStepEnd ?? onStepFinish,
    onEnd: onEnd ?? onFinish,
    onError,
  });
}
