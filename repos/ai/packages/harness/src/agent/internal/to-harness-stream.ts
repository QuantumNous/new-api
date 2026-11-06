import type { HarnessV1PromptControl } from '../../v1/harness-v1-prompt-control';
import type { HarnessV1StreamPart } from '../../v1/harness-v1-stream-part';

/**
 * Bridge an adapter's emit-based event surface into a pull-based
 * `ReadableStream<HarnessV1StreamPart>`.
 *
 * Adapters implement `doPromptTurn` / `doContinueTurn` against an `emit` callback
 * because that is the natural shape when wrapping an SDK that itself produces
 * events. Consumers (notably `HarnessAgent`) prefer a stream because that is
 * the idiomatic AI SDK shape. This helper converts the former into the latter
 * and is agnostic to which turn entry point produced the control surface — the
 * caller supplies an `invoke` thunk that wires `emit` into either method.
 *
 * Lifetime:
 *   1. Calls `invoke(emit)` immediately (which runs `doPromptTurn`/`doContinueTurn`).
 *   2. Every `emit(part)` becomes a stream chunk.
 *   3. When `control.done` resolves, the stream closes — this includes a
 *      graceful `doSuspendTurn`, which resolves `done` cleanly after draining.
 *   4. When `control.done` rejects, an `{ type: 'error', error }` part is
 *      enqueued and the stream is then closed normally. The rejection is
 *      surfaced to consumers as a discriminated-union event rather than as
 *      a stream error so iteration code does not need a separate try/catch
 *      around the consumer loop.
 *   5. The supplied `abortSignal` (if any) aborts the underlying turn and
 *      closes the stream.
 *
 * The returned `control` is the same object the adapter produced and is
 * intended for use by the consumer to submit tool results / approvals /
 * user messages back into the in-flight turn.
 */
export async function toHarnessStream(options: {
  invoke: (
    emit: (event: HarnessV1StreamPart) => void,
  ) => PromiseLike<HarnessV1PromptControl>;
}): Promise<{
  stream: ReadableStream<HarnessV1StreamPart>;
  control: HarnessV1PromptControl;
}> {
  let controller!: ReadableStreamDefaultController<HarnessV1StreamPart>;
  let closed = false;

  const stream = new ReadableStream<HarnessV1StreamPart>({
    start(c) {
      controller = c;
    },
  });

  const safeEnqueue = (part: HarnessV1StreamPart) => {
    if (closed) return;
    controller.enqueue(part);
  };

  const safeClose = () => {
    if (closed) return;
    closed = true;
    controller.close();
  };

  const control = await options.invoke(safeEnqueue);

  Promise.resolve(control.done)
    .then(
      () => safeClose(),
      (err: unknown) => {
        safeEnqueue({ type: 'error', error: err });
        safeClose();
      },
    )
    // Belt-and-suspenders: any throw inside the handlers themselves should
    // not become an unhandled rejection.
    .catch(() => {});

  return { stream, control };
}
