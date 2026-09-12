import type { UIMessageChunk } from 'ai';
import { convertAsyncIteratorToReadableStream } from 'ai/internal';
import {
  createCallbacksTransformer,
  type StreamCallbacks,
} from './stream-callbacks';
type EngineResponse = {
  delta: string;
};

export function toUIMessageStream(
  stream: AsyncIterable<EngineResponse>,
  callbacks?: StreamCallbacks,
) {
  const trimStart = trimStartOfStream();

  return convertAsyncIteratorToReadableStream(stream[Symbol.asyncIterator]())
    .pipeThrough(
      new TransformStream({
        async transform(message, controller): Promise<void> {
          controller.enqueue(trimStart(message.delta));
        },
      }),
    )
    .pipeThrough(createCallbacksTransformer(callbacks))
    .pipeThrough(
      new TransformStream<string, UIMessageChunk>({
        start: async controller => {
          controller.enqueue({ type: 'text-start', id: '1' });
        },
        transform: async (chunk, controller) => {
          controller.enqueue({ type: 'text-delta', delta: chunk, id: '1' });
        },
        flush: async controller => {
          controller.enqueue({ type: 'text-end', id: '1' });
        },
      }),
    );
}

function trimStartOfStream(): (text: string) => string {
  let isStreamStart = true;

  return (text: string): string => {
    if (isStreamStart) {
      text = text.trimStart();
      if (text) isStreamStart = false;
    }
    return text;
  };
}
