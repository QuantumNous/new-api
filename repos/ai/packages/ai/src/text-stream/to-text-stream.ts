import type { ToolSet } from '@ai-sdk/provider-utils';
import type { TextStreamPart } from '../generate-text/stream-text-result';

/**
 * Converts a stream of `TextStreamPart` chunks into a stream of text deltas.
 */
export function toTextStream<TOOLS extends ToolSet = ToolSet>({
  stream,
}: {
  stream: ReadableStream<TextStreamPart<TOOLS>>;
}): ReadableStream<string> {
  return stream.pipeThrough(
    new TransformStream<TextStreamPart<TOOLS>, string>({
      transform(part, controller) {
        if (part.type === 'text-delta') {
          controller.enqueue(part.text);
        }
      },
    }),
  );
}
